-- =============================================================================
-- Excelsior — Fase 1: organizaciones, miembros, invitaciones y registro
-- =============================================================================
--
-- Modelo (docs/ROLES.md, docs/ARCHITECTURE.md §16 y §20):
--   · profiles.platform_role: client | staff | admin (equipo de R3ZON).
--   · organizations: la empresa cliente. Un usuario puede estar en varias (T-13).
--   · organization_members: usuario ↔ organización con rol owner | member | billing.
--   · invitations: única puerta de entrada. Token aleatorio (solo se guarda su
--     hash), de un solo uso, con caducidad y atado al email (T-11).
--   · audit_log: lo sensible, escrito solo por triggers.
--
-- Alta solo por invitación — dónde está cada barrera:
--   1. hook_before_user_created (hook de Supabase Auth): rechaza el alta si no
--      hay invitación válida. Con email + contraseña exige además el token (en
--      los metadatos del alta): tenerlo prueba que se controla ese email. Con
--      Google basta una invitación pendiente para ese email, porque Google ya
--      ha verificado que el email es suyo.
--   2. strip_invitation_token (INSERT/UPDATE en auth.users y auth.identities):
--      el token no se llega a guardar en ningún sitio.
--   3. accept_invitations_on_signup (AFTER INSERT en auth.users): crea la
--      pertenencia y marca la invitación como aceptada EN LA MISMA transacción
--      que el alta: no hay carrera ni estado intermedio.
--   4. invitations_guard_transition: ninguna vía (RPC, panel, script) puede
--      aceptar una invitación caducada, revocada, ya usada o con otro email.
--
-- REGLA: esta migración, una vez aplicada en cualquier entorno, no se edita.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tipos y nivel de plataforma
-- ─────────────────────────────────────────────────────────────────────────────
create type public.platform_role as enum ('client', 'staff', 'admin');
create type public.org_role as enum ('owner', 'member', 'billing');

comment on type public.platform_role is
  'Quién es la persona para R3ZON: client (usuario de una empresa cliente), staff o admin (equipo). docs/ROLES.md.';
comment on type public.org_role is
  'Rol dentro de una empresa cliente: owner (firma y gestiona), member, billing (facturación). docs/ROLES.md.';

-- `authenticated` solo tiene UPDATE (display_name) en profiles: nadie puede
-- cambiarse su propio nivel desde la app.
alter table public.profiles
  add column platform_role public.platform_role not null default 'client';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Registro de actividad
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes que el resto: los triggers de las demás tablas escriben aquí.
-- (`organization_id` sin FK a propósito: el registro sobrevive a la
-- organización que describe, y una FK con `set null` borraría el dato.)
create table public.audit_log (
  id              uuid primary key default public.uuidv7(),
  created_at      timestamptz not null default now(),
  actor_id        uuid references auth.users (id) on delete set null,
  organization_id uuid,
  action          text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  details         jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'Acciones sensibles (invitaciones, pertenencias, roles). Solo escriben triggers SECURITY DEFINER; lo lee el staff. Nunca guarda tokens.';

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_organization_id_idx on public.audit_log (organization_id, created_at desc);

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
  'Escribe en audit_log. Solo la llaman otros triggers/funciones: nadie la ejecuta como RPC.';
revoke execute on function public.write_audit(text, uuid, jsonb, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Organizaciones y miembros
-- ─────────────────────────────────────────────────────────────────────────────
create table public.organizations (
  id         uuid primary key default public.uuidv7(),
  name       text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizations_name_length check (char_length(btrim(name)) between 1 and 200)
);

comment on table public.organizations is
  'Empresa cliente (tenant). Todo lo de un cliente cuelga de su organization_id (T-08).';

create index organizations_created_by_idx on public.organizations (created_by);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'member',
  created_at      timestamptz not null default now(),

  primary key (organization_id, user_id)
);

comment on table public.organization_members is
  'Pertenencia de un usuario a una empresa cliente, con su rol. N:M: un usuario puede estar en varias (T-13).';

-- La PK empieza por organization_id; las consultas «mis organizaciones» van por user_id.
create index organization_members_user_id_idx on public.organization_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Funciones de permiso (las usan las policies)
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER porque consultan tablas con RLS desde policies de esas
-- mismas tablas: como invoker, la policy de profiles llamaría a is_staff(),
-- que leería profiles, que evaluaría la policy… (recursión infinita). Solo
-- devuelven un booleano o un rol del PROPIO usuario: no filtran datos.
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

comment on function public.is_staff() is 'true si el usuario actual es staff o admin de R3ZON. Para policies.';
comment on function public.is_admin() is 'true si el usuario actual es admin de R3ZON. Para policies.';
comment on function public.is_org_member(uuid) is 'true si el usuario actual pertenece a la organización. Para policies.';
comment on function public.org_role_of(uuid) is 'Rol del usuario actual en la organización (null si no pertenece). Para policies y la UI.';

revoke execute on function public.is_staff(), public.is_admin(), public.is_org_member(uuid), public.org_role_of(uuid)
  from public, anon;
grant execute on function public.is_staff(), public.is_admin(), public.is_org_member(uuid), public.org_role_of(uuid)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Reglas de organizaciones y miembros (triggers)
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
  perform public.write_audit('organization.created', new.id, jsonb_build_object('name', new.name));
  return null;
end;
$$;
revoke execute on function public.organizations_audit() from public, anon, authenticated;

create trigger organizations_audit
  after insert on public.organizations
  for each row execute function public.organizations_audit();

-- Una organización que ya tiene propietario no puede quedarse sin ninguno
-- (alguien tiene que poder firmar). Al principio puede no tener ninguno: la
-- crea el staff y el propietario llega con la invitación.
create function public.organization_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     -- Si se borra la organización entera (cascada), no hay nada que proteger.
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
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
-- 6. Invitaciones
-- ─────────────────────────────────────────────────────────────────────────────
-- Estado derivado de las columnas (ARCHITECTURE.md §20):
--   pendiente  = accepted_at y revoked_at nulos y expires_at > now()
--   caducada   = pendiente en columnas pero expires_at <= now()
--   aceptada   = accepted_at no nulo
--   revocada   = revoked_at no nulo
create table public.invitations (
  id              uuid primary key default public.uuidv7(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role            public.org_role not null default 'owner',
  token_hash      bytea not null unique,
  expires_at      timestamptz not null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz,

  constraint invitations_email_normalized check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  constraint invitations_single_outcome check (accepted_at is null or revoked_at is null),
  constraint invitations_accepted_by_needs_accepted_at check (accepted_by is null or accepted_at is not null),
  constraint invitations_token_hash_sha256 check (octet_length(token_hash) = 32),
  constraint invitations_expires_after_creation check (expires_at > created_at)
);

comment on table public.invitations is
  'Invitación de un solo uso para entrar en una organización. Solo se guarda el SHA-256 del token. docs/AUTH.md.';

create index invitations_organization_id_idx on public.invitations (organization_id);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);
-- El hook y el alta buscan invitaciones pendientes por email.
create index invitations_pending_email_idx on public.invitations (email)
  where accepted_at is null and revoked_at is null;
-- Una sola invitación abierta por persona y organización: reenviar revoca la anterior.
create unique index invitations_one_open_per_org_email on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create function public.invitations_set_created_by()
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

create trigger invitations_set_created_by
  before insert on public.invitations
  for each row execute function public.invitations_set_created_by();

-- Transiciones permitidas. Es la única barrera, valga para quien valga la
-- escritura (staff, RPC de aceptación, trigger del alta, script).
create function public.invitations_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if (new.organization_id, new.email, new.role, new.token_hash, new.expires_at, new.created_at)
     is distinct from
     (old.organization_id, old.email, old.role, old.token_hash, old.expires_at, old.created_at)
  then
    raise exception 'Una invitación no se modifica: se revoca y se crea otra' using errcode = 'P0001';
  end if;

  -- Las FK con `on delete set null` pueden vaciar created_by / accepted_by.
  if new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'created_by no se puede cambiar' using errcode = 'P0001';
  end if;

  -- Un desenlace (aceptada o revocada) es definitivo.
  if old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at
     or old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'La invitación ya está cerrada' using errcode = 'P0001';
  end if;

  if old.accepted_at is null and new.accepted_at is not null then
    if old.revoked_at is not null then
      raise exception 'La invitación está revocada' using errcode = 'P0001';
    end if;
    if old.expires_at <= now() then
      raise exception 'La invitación ha caducado' using errcode = 'P0001';
    end if;
    if new.accepted_by is null then
      raise exception 'Falta quién la acepta' using errcode = 'P0001';
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = new.accepted_by;
    if v_email is distinct from old.email then
      raise exception 'La invitación es para otro email' using errcode = 'P0001';
    end if;
  elsif new.accepted_by is distinct from old.accepted_by and new.accepted_by is not null then
    raise exception 'accepted_by solo se fija al aceptar' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
revoke execute on function public.invitations_guard_transition() from public, anon, authenticated;

create trigger invitations_guard_transition
  before update on public.invitations
  for each row execute function public.invitations_guard_transition();

create function public.invitations_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nunca el token ni su hash.
  if tg_op = 'INSERT' then
    perform public.write_audit('invitation.created', new.organization_id,
      jsonb_build_object('invitation_id', new.id, 'email', new.email, 'role', new.role, 'expires_at', new.expires_at));
  elsif old.accepted_at is null and new.accepted_at is not null then
    perform public.write_audit('invitation.accepted', new.organization_id,
      jsonb_build_object('invitation_id', new.id, 'user_id', new.accepted_by), new.accepted_by);
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform public.write_audit('invitation.revoked', new.organization_id,
      jsonb_build_object('invitation_id', new.id));
  end if;
  return null;
end;
$$;
revoke execute on function public.invitations_audit() from public, anon, authenticated;

create trigger invitations_audit
  after insert or update on public.invitations
  for each row execute function public.invitations_audit();

-- Crear una invitación. SECURITY INVOKER: quién puede crearla lo decide la RLS
-- de la tabla (solo staff), no esta función. Devuelve el token en claro UNA
-- vez; en la base solo queda su hash. Revoca la invitación abierta anterior
-- para el mismo email y organización (reenviar = invitación nueva).
create function public.create_invitation(
  p_organization_id uuid,
  p_email text,
  p_role public.org_role default 'owner',
  p_valid_for interval default interval '7 days'
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email text := lower(btrim(p_email));
begin
  if p_valid_for <= interval '0' or p_valid_for > interval '30 days' then
    raise exception 'La validez debe estar entre 0 y 30 días' using errcode = 'P0001';
  end if;

  update public.invitations
     set revoked_at = now()
   where organization_id = p_organization_id and email = v_email
     and accepted_at is null and revoked_at is null;

  insert into public.invitations (organization_id, email, role, token_hash, expires_at)
  values (p_organization_id, v_email, p_role, extensions.digest(v_token, 'sha256'), now() + p_valid_for);

  return v_token;
end;
$$;

comment on function public.create_invitation(uuid, text, public.org_role, interval) is
  'Crea una invitación (solo staff, por RLS) y devuelve el token en claro una única vez.';
grant execute on function public.create_invitation(uuid, text, public.org_role, interval) to authenticated;

-- Aceptar una invitación con una cuenta que YA existe (usuario en varias
-- empresas, T-13). Las cuentas nuevas la aceptan en el propio alta (abajo).
-- SECURITY DEFINER porque el usuario aún no pertenece a la organización y la
-- RLS no le deja ver la invitación ni crear su pertenencia. Las reglas (email,
-- caducidad, un solo uso) las aplica invitations_guard_transition.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Hace falta sesión' using errcode = '42501';
  end if;

  select * into v_invitation from public.invitations
   where token_hash = extensions.digest(p_token, 'sha256')
   for update;

  if not found or v_invitation.accepted_at is not null or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'La invitación no es válida' using errcode = 'P0001';
  end if;

  -- Primero la invitación: si el email no coincide, el trigger aborta antes de
  -- crear ninguna pertenencia.
  update public.invitations set accepted_at = now(), accepted_by = v_user_id where id = v_invitation.id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invitation.organization_id, v_user_id, v_invitation.role)
  on conflict (organization_id, user_id) do nothing;

  return v_invitation.organization_id;
end;
$$;

comment on function public.accept_invitation(text) is
  'Acepta una invitación con la cuenta actual (que ya existía). Reglas en invitations_guard_transition.';
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Alta solo por invitación (Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────────
-- Hook `before_user_created` (supabase/config.toml y, en Cloud, el panel →
-- Auth Hooks). Corre ANTES de crear el usuario, en cualquier vía de alta.
-- El mensaje de rechazo es el mismo en todos los casos: no revela si el email
-- tiene una invitación.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_token text := event -> 'user' -> 'user_metadata' ->> 'invitation_token';
  v_ok boolean := false;
begin
  if coalesce(v_email, '') <> '' then
    if v_provider = 'email' then
      v_ok := v_token is not null and exists (
        select 1 from public.invitations i
         where i.token_hash = extensions.digest(v_token, 'sha256')
           and i.email = v_email
           and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
      );
    elsif v_provider = 'google' then
      v_ok := exists (
        select 1 from public.invitations i
         where i.email = v_email
           and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
      );
    end if;
  end if;

  if v_ok then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Solo puedes crear una cuenta con una invitación válida de R3ZON.'
  ));
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Hook de Supabase Auth: rechaza toda alta sin invitación válida. Solo lo ejecuta supabase_auth_admin.';
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- El token viaja en los metadatos del alta solo para que el hook lo vea: no se
-- guarda. Supabase Auth escribe esos metadatos en DOS sitios y no solo con el
-- INSERT del usuario (comprobado con un alta real: un trigger solo de INSERT
-- en auth.users lo dejaba pasar): `auth.users.raw_user_meta_data` y
-- `auth.identities.identity_data`, en INSERT o en UPDATE. Se limpian los dos.
create function public.strip_invitation_token()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- IF anidados y no `tg_table_name = … and new.campo …`: SQL no garantiza el
  -- orden de evaluación de un AND, y leer `new.identity_data` sobre una fila de
  -- auth.users aborta el alta («record "new" has no field»).
  if tg_table_name = 'users' then
    if new.raw_user_meta_data ? 'invitation_token' then
      new.raw_user_meta_data := new.raw_user_meta_data - 'invitation_token';
    end if;
  else
    if new.identity_data ? 'invitation_token' then
      new.identity_data := new.identity_data - 'invitation_token';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.strip_invitation_token() from public, anon, authenticated;

create trigger strip_invitation_token
  before insert or update on auth.users
  for each row execute function public.strip_invitation_token();

create trigger strip_invitation_token
  before insert or update on auth.identities
  for each row execute function public.strip_invitation_token();

-- Acepta, en la misma transacción que el alta, las invitaciones pendientes para
-- ese email (el hook ya comprobó que existen y, con contraseña, que el token es
-- suyo).
create function public.accept_invitations_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations;
begin
  if new.email is null then
    return null;
  end if;

  for v_invitation in
    select * from public.invitations
     where email = lower(new.email)
       and accepted_at is null and revoked_at is null and expires_at > now()
     for update
  loop
    update public.invitations set accepted_at = now(), accepted_by = new.id where id = v_invitation.id;
    insert into public.organization_members (organization_id, user_id, role)
    values (v_invitation.organization_id, new.id, v_invitation.role)
    on conflict (organization_id, user_id) do nothing;
  end loop;

  return null;
end;
$$;
revoke execute on function public.accept_invitations_on_signup() from public, anon, authenticated;

create trigger on_auth_user_created_accept_invitations
  after insert on auth.users
  for each row execute function public.accept_invitations_on_signup();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Privilegios de tabla: mínimos y explícitos
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.organizations, public.organization_members, public.invitations, public.audit_log
  from anon, authenticated;

grant select, insert (name), update (name) on table public.organizations to authenticated;
grant select, insert (organization_id, user_id, role), update (role), delete
  on table public.organization_members to authenticated;
grant select, insert (organization_id, email, role, token_hash, expires_at), update (revoked_at)
  on table public.invitations to authenticated;
grant select on table public.audit_log to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- profiles: el staff ve todos los perfiles (panel de clientes).
create policy profiles_select_staff
  on public.profiles for select
  to authenticated
  using ((select public.is_staff()));

-- organizations: los miembros ven la suya; el staff, todas y las gestiona.
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

-- organization_members: los miembros ven a sus compañeros; gestiona el staff
-- (que el propietario gestione a su equipo llega en la Fase 6).
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

-- invitations: solo el staff (el cliente la usa por el enlace, no la lee).
create policy invitations_select_staff
  on public.invitations for select
  to authenticated
  using ((select public.is_staff()));

create policy invitations_insert_staff
  on public.invitations for insert
  to authenticated
  with check ((select public.is_staff()));

create policy invitations_update_staff
  on public.invitations for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- audit_log: solo lectura, solo staff.
create policy audit_log_select_staff
  on public.audit_log for select
  to authenticated
  using ((select public.is_staff()));
