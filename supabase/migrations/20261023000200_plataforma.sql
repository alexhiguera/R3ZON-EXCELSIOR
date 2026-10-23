-- =============================================================================
-- Excelsior · módulo PLATAFORMA — niveles del equipo y registro de actividad
-- =============================================================================
--
-- · profiles.platform_role: client | staff | admin (docs/ROLES.md, T-12).
-- · is_staff() / is_admin(): la ÚNICA forma en que una policy pregunta «¿es
--   del equipo de R3ZON?». El staff ve más filas por permiso, nunca saltándose
--   la RLS (docs/ARCHITECTURE.md §16).
-- · audit_log: registro de acciones sensibles, INMUTABLE (solo añadir) y
--   conservado 6 años (docs/RGPD.md). Lo escriben solo triggers.
--
-- Los demás módulos dependen de este; este solo del core (profiles).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nivel de plataforma
-- ─────────────────────────────────────────────────────────────────────────────
create type public.platform_role as enum ('client', 'staff', 'admin');

comment on type public.platform_role is
  'Quién es la persona para R3ZON: client (usuario de una empresa cliente), staff o admin (equipo). docs/ROLES.md.';

-- `authenticated` solo tiene UPDATE (display_name) en profiles (core): nadie
-- puede cambiarse su propio nivel desde la app.
alter table public.profiles
  add column platform_role public.platform_role not null default 'client';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Funciones de permiso
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER porque las usan policies de tablas con RLS, incluida la de
-- profiles: como invoker, la policy de profiles llamaría a is_staff(), que
-- leería profiles, que evaluaría la policy… (recursión infinita). Solo
-- responden sobre el PROPIO usuario: no devuelven datos de nadie.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.platform_role in ('staff', 'admin') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.platform_role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_staff() is 'true si el usuario actual es staff o admin de R3ZON. Para policies.';
comment on function public.is_admin() is 'true si el usuario actual es admin de R3ZON. Para policies.';

revoke execute on function public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.is_staff(), public.is_admin() to authenticated;

-- El staff ve todos los perfiles (panel de clientes). Un cliente, solo el suyo
-- (policy del core).
create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using ((select public.is_staff()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registro de actividad (inmutable)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sin claves foráneas, a propósito:
--   · `actor_id`: si se borra al usuario (derecho de supresión), el registro
--     conserva un identificador que ya no apunta a ninguna persona
--     (seudonimizado de forma irreversible), y la traza sigue siendo útil.
--     Con una FK `on delete set null` se perdería; con `cascade`, se borraría
--     la propia evidencia.
--   · `organization_id`: el registro sobrevive a la organización que describe.
-- `details` NUNCA lleva datos personales directos (emails, nombres) ni
-- secretos: solo ids, roles y estados. Lo vigila tests/db/plataforma.test.ts.
create table public.audit_log (
  id              uuid primary key default public.uuidv7(),
  created_at      timestamptz not null default now(),
  actor_id        uuid,
  organization_id uuid,
  action          text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  details         jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'Acciones sensibles. Solo añadir (inmutable), escrita por triggers, leída por el staff, conservada 6 años. Sin datos personales directos ni tokens.';

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_organization_id_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_created_at_idx on public.audit_log (created_at);

-- Inmutable para TODOS, también para postgres y service_role (que se saltan la
-- RLS y los grants): la única vía de borrado es la purga por antigüedad.
create function public.audit_log_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('excelsior.audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_log es de solo añadir: no se modifica ni se borra'
    using errcode = 'P0001';
end;
$$;
revoke execute on function public.audit_log_immutable() from public, anon, authenticated;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

-- Purga por plazo de conservación: solo filas de más de 6 años. Pensada para
-- una tarea programada con service_role (docs/RGPD.md); nadie más la ejecuta.
create function public.audit_log_purge(p_before timestamptz)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_borradas bigint;
begin
  if p_before > now() - interval '6 years' then
    raise exception 'Solo se purgan registros de más de 6 años' using errcode = 'P0001';
  end if;
  perform set_config('excelsior.audit_purge', 'on', true);
  delete from public.audit_log where created_at < p_before;
  get diagnostics v_borradas = row_count;
  perform set_config('excelsior.audit_purge', 'off', true);
  return v_borradas;
end;
$$;

comment on function public.audit_log_purge(timestamptz) is
  'Purga del registro por plazo de conservación (6 años). Solo service_role.';
revoke execute on function public.audit_log_purge(timestamptz) from public, anon, authenticated;
grant execute on function public.audit_log_purge(timestamptz) to service_role;

-- Escritura: solo desde otros triggers/funciones de la base.
create function public.write_audit(
  p_action text,
  p_organization_id uuid,
  p_details jsonb,
  p_actor_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, organization_id, action, details)
  values (coalesce(p_actor_id, (select auth.uid())), p_organization_id, p_action, coalesce(p_details, '{}'::jsonb));
$$;

comment on function public.write_audit(text, uuid, jsonb, uuid) is
  'Escribe en audit_log. Solo la llaman triggers/funciones: nadie la ejecuta como RPC.';
revoke execute on function public.write_audit(text, uuid, jsonb, uuid) from public, anon, authenticated;

create function public.profiles_audit_platform_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit('profile.platform_role_changed', null,
    jsonb_build_object('user_id', new.id, 'from', old.platform_role, 'to', new.platform_role));
  return null;
end;
$$;
revoke execute on function public.profiles_audit_platform_role() from public, anon, authenticated;

create trigger profiles_audit_platform_role
  after update of platform_role on public.profiles
  for each row when (old.platform_role is distinct from new.platform_role)
  execute function public.profiles_audit_platform_role();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privilegios y RLS del registro
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

alter table public.audit_log enable row level security;

create policy audit_log_select_staff
  on public.audit_log for select
  to authenticated
  using ((select public.is_staff()));
