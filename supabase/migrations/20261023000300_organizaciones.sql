-- =============================================================================
-- Excelsior · módulo ORGANIZACIONES — empresas cliente y sus miembros
-- =============================================================================
--
-- · organizations: la empresa cliente (tenant). Todo lo de un cliente cuelga de
--   su `organization_id` (T-08). No se borra desde la app: se ARCHIVA. Los datos
--   con obligación legal de conservación (contratos, facturas: 6 años) apuntan a
--   ella con `on delete restrict` (docs/RGPD.md).
-- · organization_members: usuario ↔ empresa con rol. N:M (T-13).
--
-- Depende de: plataforma.
-- =============================================================================

create type public.org_role as enum ('owner', 'member', 'billing');

comment on type public.org_role is
  'Rol dentro de una empresa cliente: owner (firma y gestiona), member, billing (facturación). docs/ROLES.md.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default public.uuidv7(),
  name        text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,

  constraint organizations_name_length check (char_length(btrim(name)) between 1 and 200)
);

comment on table public.organizations is
  'Empresa cliente (tenant). Se archiva (archived_at), no se borra desde la app.';

create index organizations_created_by_idx on public.organizations (created_by);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'member',
  created_at      timestamptz not null default now(),

  primary key (organization_id, user_id)
);

comment on table public.organization_members is
  'Pertenencia de un usuario a una empresa cliente, con su rol. Es un dato de ACCESO: se borra con el usuario.';

-- La PK empieza por organization_id; «mis organizaciones» va por user_id.
create index organization_members_user_id_idx on public.organization_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Funciones de permiso (para policies de este y de los demás módulos)
-- ─────────────────────────────────────────────────────────────────────────────
-- Definer por lo mismo que is_staff(): consultan una tabla con RLS desde
-- policies. Solo responden sobre el usuario actual.
create function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_organization_id and m.user_id = (select auth.uid())
  );
$$;

create function public.org_role_of(p_organization_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m
   where m.organization_id = p_organization_id and m.user_id = (select auth.uid());
$$;

comment on function public.is_org_member(uuid) is 'true si el usuario actual pertenece a la organización. Para policies.';
comment on function public.org_role_of(uuid) is 'Rol del usuario actual en la organización (null si no pertenece).';

revoke execute on function public.is_org_member(uuid), public.org_role_of(uuid) from public, anon;
grant execute on function public.is_org_member(uuid), public.org_role_of(uuid) to authenticated;

-- Directorio de miembros con su email, SOLO para el equipo de R3ZON (contactar
-- con el cliente). El email vive en auth.users, que la app no lee; duplicarlo
-- en profiles sería duplicar un dato personal (core). Definer para leer
-- auth.users; la comprobación de staff está DENTRO porque es la única barrera.
create function public.organization_directory(p_organization_id uuid)
returns table (user_id uuid, display_name text, email text, role public.org_role, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo de R3ZON' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.display_name, u.email::text, m.role, m.created_at
      from public.organization_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id
     where m.organization_id = p_organization_id
     order by m.created_at;
end;
$$;

comment on function public.organization_directory(uuid) is
  'Miembros de una empresa con su email. Solo staff (comprobado dentro).';
revoke execute on function public.organization_directory(uuid) from public, anon;
grant execute on function public.organization_directory(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Reglas (triggers)
-- ─────────────────────────────────────────────────────────────────────────────
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- `created_by` lo pone la base, no el cliente.
create function public.organizations_set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function public.organizations_set_created_by() from public, anon, authenticated;

create trigger organizations_set_created_by
  before insert on public.organizations
  for each row execute function public.organizations_set_created_by();

create function public.organizations_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El nombre de una empresa no es un dato personal de una persona física,
  -- salvo el de un autónomo: tampoco se copia al registro.
  if tg_op = 'INSERT' then
    perform public.write_audit('organization.created', new.id, '{}'::jsonb);
  elsif new.archived_at is distinct from old.archived_at then
    perform public.write_audit(
      case when new.archived_at is null then 'organization.unarchived' else 'organization.archived' end,
      new.id, '{}'::jsonb);
  end if;
  return null;
end;
$$;
revoke execute on function public.organizations_audit() from public, anon, authenticated;

create trigger organizations_audit
  after insert or update of archived_at on public.organizations
  for each row execute function public.organizations_audit();

-- Una organización que ya tiene propietario no se queda sin ninguno (alguien
-- tiene que poder firmar). Al principio puede no tenerlo: la crea el staff y
-- el propietario llega con la invitación.
create function public.organization_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     -- Si se borra la organización (cascada) o el usuario (cascada), no aplica.
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.organization_members m
        where m.organization_id = old.organization_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'La organización no puede quedarse sin propietario'
      using errcode = 'P0001', hint = 'Asigna otro propietario antes.';
  end if;
  return null;
end;
$$;
revoke execute on function public.organization_members_keep_owner() from public, anon, authenticated;

create trigger organization_members_keep_owner
  after update of role or delete on public.organization_members
  for each row execute function public.organization_members_keep_owner();

create function public.organization_members_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('member.added', new.organization_id,
      jsonb_build_object('user_id', new.user_id, 'role', new.role));
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.write_audit('member.role_changed', new.organization_id,
      jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('member.removed', old.organization_id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role));
  end if;
  return null;
end;
$$;
revoke execute on function public.organization_members_audit() from public, anon, authenticated;

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.organization_members_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privilegios: mínimos y explícitos. Nadie borra organizaciones desde la app.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.organizations, public.organization_members from anon, authenticated;

grant select, insert (name), update (name, archived_at) on table public.organizations to authenticated;
grant select, insert (organization_id, user_id, role), update (role), delete
  on table public.organization_members to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Los miembros ven la suya; el staff, todas y las gestiona.
create policy organizations_select
  on public.organizations for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(id));

create policy organizations_insert_staff
  on public.organizations for insert
  to authenticated
  with check ((select public.is_staff()));

create policy organizations_update_staff
  on public.organizations for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Los miembros ven a sus compañeros; gestiona el staff (que el propietario
-- gestione a su equipo llega en la Fase 6).
create policy organization_members_select
  on public.organization_members for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

create policy organization_members_insert_staff
  on public.organization_members for insert
  to authenticated
  with check ((select public.is_staff()));

create policy organization_members_update_staff
  on public.organization_members for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy organization_members_delete_staff
  on public.organization_members for delete
  to authenticated
  using ((select public.is_staff()));
