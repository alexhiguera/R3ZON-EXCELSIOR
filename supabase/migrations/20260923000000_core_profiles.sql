-- =============================================================================
-- Core R3ZON — `public.profiles` y los permisos por defecto de `public`
-- =============================================================================
--
-- Única tabla del core. No es una entidad de negocio: es la fila 1:1 con
-- `auth.users` que casi todo producto acaba necesitando, y la que permite que
-- la plantilla nazca probando de verdad migraciones, Prisma, drift, RLS,
-- triggers y tests contra PostgreSQL.
--
-- No guarda el email: ya vive en `auth.users`, y duplicar un dato personal es
-- duplicar lo que hay que rectificar, exportar y borrar (RGPD).
--
-- REGLA: esta migración, una vez aplicada en cualquier entorno, no se edita.
-- Lo que falte va en una migración nueva (CLAUDE.md → Migraciones).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Permisos por defecto: nada se ejecuta porque sí
-- ─────────────────────────────────────────────────────────────────────────────
-- PostgreSQL concede EXECUTE a PUBLIC en toda función nueva, y Supabase además
-- a `anon`. Una función SECURITY DEFINER ejecutable por `anon` es la clase de
-- fallo que más se repitió en el proyecto de origen (varias migraciones de
-- «revocar anon» a posteriori). Aquí se corta de raíz: las funciones futuras de
-- `public` nacen sin EXECUTE para PUBLIC ni `anon`; si una RPC debe ser pública,
-- se concede de forma explícita y se justifica en su migración.
--
-- Son DOS sentencias distintas a propósito. El EXECUTE a PUBLIC es un
-- privilegio por defecto GLOBAL, y los default privileges «in schema» solo
-- pueden AÑADIR sobre los globales, nunca quitar: con `in schema public` la
-- primera no haría nada y `anon` seguiría ejecutando por ser parte de PUBLIC.
-- El test «las funciones nuevas de public nacen sin EXECUTE…» lo vigila.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Utilidad común: `updated_at`
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico: pone updated_at = now() en cada UPDATE. Reutilizable por cualquier tabla.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120)
);

comment on table public.profiles is
  'Perfil 1:1 con auth.users. Lo crea el trigger on_auth_user_created; se borra en cascada con el usuario.';

-- `id` es PK y FK a la vez: el índice de la PK cubre la clave foránea, así que
-- no hace falta ningún índice adicional.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Alta automática
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER porque escribe en `public` desde un trigger de `auth`, donde
-- el rol que inserta no tiene permisos sobre `profiles`. Por eso lleva
-- `search_path` vacío y todo cualificado: una definer con search_path heredado
-- puede ser engañada con un objeto homónimo en otro esquema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 120)
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea la fila de public.profiles al registrarse un usuario. Solo la invoca el trigger de auth.users.';

-- Un trigger no necesita EXECUTE: nadie debe poder llamarla como RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Privilegios de tabla: mínimos y explícitos
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase concede todo a `anon` y `authenticated` por defecto; la RLS filtra
-- FILAS, pero los grants deciden qué OPERACIONES existen. Se dejan solo las que
-- el producto usa:
--   · anon: nada.
--   · authenticated: leer, y actualizar solo `display_name` (no puede tocar su
--     `id` ni las fechas). Insertar lo hace el trigger; borrar, la cascada.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- `(select auth.uid())` y no `auth.uid()` a secas: envuelto en un SELECT,
-- Postgres lo evalúa una vez por consulta y no una vez por fila.
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
