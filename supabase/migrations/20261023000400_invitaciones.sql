-- =============================================================================
-- Excelsior · módulo INVITACIONES — alta solo por invitación (T-02, T-11, T-15)
-- =============================================================================
--
-- Dónde está cada barrera (docs/AUTH.md):
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
-- Estado derivado de columnas (docs/ARCHITECTURE.md §20):
--   pendiente = accepted_at y revoked_at nulos y expires_at > now()
--   caducada  = pendiente en columnas pero expires_at <= now()
--   aceptada  = accepted_at · revocada = revoked_at
--
-- Depende de: plataforma, organizaciones.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- Ni vencida al nacer ni válida más de 30 días: también para quien inserte
  -- sin pasar por create_invitation.
  constraint invitations_validity_window check (
    expires_at > created_at and expires_at <= created_at + interval '30 days'
  )
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reglas (triggers)
-- ─────────────────────────────────────────────────────────────────────────────
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
revoke execute on function public.invitations_set_created_by() from public, anon, authenticated;

create trigger invitations_set_created_by
  before insert on public.invitations
  for each row execute function public.invitations_set_created_by();

-- Transiciones permitidas. Única barrera, valga para quien valga la escritura.
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
  -- Ni el token, ni su hash, ni el email (dato personal: ya está en la tabla y
  -- el registro se conserva más tiempo).
  if tg_op = 'INSERT' then
    perform public.write_audit('invitation.created', new.organization_id,
      jsonb_build_object('invitation_id', new.id, 'role', new.role, 'expires_at', new.expires_at));
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Funciones de la app
-- ─────────────────────────────────────────────────────────────────────────────
-- Crear una invitación. SECURITY INVOKER: quién puede lo decide la RLS (solo
-- staff). Devuelve el token en claro UNA vez; en la base solo queda su hash.
-- Revoca la invitación abierta anterior para el mismo email y organización.
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

-- Aceptar con una cuenta que YA existe (usuario en varias empresas, T-13).
-- Definer porque el usuario aún no pertenece a la organización y la RLS no le
-- deja ver la invitación ni crear su pertenencia. Las reglas (email,
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

-- Minimización (RGPD art. 5.1.c y e): una invitación cerrada (aceptada,
-- revocada o caducada) solo guarda el email de alguien que quizá nunca fue
-- cliente. Se purgan pasado un plazo; la traza queda en audit_log sin el email.
-- Plazo mínimo 90 días; el definitivo lo fija la decisión D-13 (docs/RGPD.md).
create function public.invitations_purge(p_closed_before timestamptz)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_borradas bigint;
begin
  if p_closed_before > now() - interval '90 days' then
    raise exception 'Solo se purgan invitaciones cerradas hace más de 90 días' using errcode = 'P0001';
  end if;
  delete from public.invitations
   where coalesce(accepted_at, revoked_at, expires_at) < p_closed_before
     and (accepted_at is not null or revoked_at is not null or expires_at <= now());
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

comment on function public.invitations_purge(timestamptz) is
  'Purga de invitaciones cerradas (minimización RGPD). Solo service_role.';
revoke execute on function public.invitations_purge(timestamptz) from public, anon, authenticated;
grant execute on function public.invitations_purge(timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Alta solo por invitación (Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────────
-- Hook `before_user_created` (supabase/config.toml; en Cloud, panel → Auth
-- Hooks). Corre ANTES de crear el usuario. Mensaje único en todos los rechazos:
-- no revela si un email tiene invitación.
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
-- `auth.identities.identity_data`, en INSERT o en UPDATE.
create function public.strip_invitation_token()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- IF anidados y no `tg_table_name = … and new.campo …`: PL/pgSQL no garantiza
  -- el orden de un AND, y leer `new.identity_data` sobre una fila de auth.users
  -- aborta el alta («record "new" has no field»).
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

-- Acepta, en la misma transacción que el alta, las invitaciones pendientes de
-- ese email (el hook ya comprobó que existen y, con contraseña, el token).
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
-- 5. Privilegios y RLS: solo el staff (el cliente usa el enlace, no la tabla)
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.invitations from anon, authenticated;
grant select, insert (organization_id, email, role, token_hash, expires_at), update (revoked_at)
  on table public.invitations to authenticated;

alter table public.invitations enable row level security;

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
