-- =============================================================================
-- Excelsior · módulo CONTRATACIONES — un servicio contratado por un cliente
-- =============================================================================
--
-- · engagements: la contratación. Apunta a una VERSIÓN del servicio (las
--   condiciones no cambian aunque cambie el catálogo), con su precio final y
--   sus condiciones particulares. Dato con obligación de conservación (6 años):
--   `on delete restrict` hacia la organización y no se borra desde la app.
-- · engagement_status_history: cada cambio de estado, quién y cuándo.
-- · invite_to_service(): el paso estrella de la Fase 2. En una transacción:
--   contratación + invitación, y devuelve el enlace.
--
-- Máquina de estados (docs/ARCHITECTURE.md §20). Solo se permiten estas
-- transiciones, valga para quien valga la escritura (trigger):
--
--   borrador ─► invitada ─► datos_completos ─► firmada ─► pago_en_curso ─► pagada ─► activa ─► finalizada
--      │           │              │               │              │            │         │
--      └───────────┴──────────────┴─► cancelada   ├─► rescindida ◄┴────────────┴─────────┘
--                                                 └─ pago_en_curso/pagada/activa ─► en_impago ─► (pago_en_curso | activa | rescindida)
--
-- «Cuenta creada» no es un estado: se deriva de la invitación aceptada.
--
-- Depende de: plataforma, organizaciones, invitaciones, servicios.
-- =============================================================================

create type public.engagement_status as enum (
  'borrador', 'invitada', 'datos_completos', 'firmada', 'pago_en_curso', 'pagada',
  'activa', 'finalizada', 'cancelada', 'rescindida', 'en_impago'
);

comment on type public.engagement_status is
  'Estado de una contratación. Transiciones en engagement_transition_allowed(). docs/ARCHITECTURE.md §20.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.engagements (
  id                 uuid primary key default public.uuidv7(),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  service_version_id uuid not null references public.service_versions (id) on delete restrict,
  invitation_id      uuid references public.invitations (id) on delete set null,
  status             public.engagement_status not null default 'borrador',
  price_cents        bigint not null,
  conditions         text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  status_changed_at  timestamptz not null default now(),

  constraint engagements_price check (price_cents >= 0 and price_cents <= 100000000000),
  constraint engagements_conditions_length check (conditions is null or char_length(conditions) <= 4000)
);

comment on table public.engagements is
  'Contratación: servicio (versión) contratado por un cliente, con precio final y estado. Se conserva 6 años.';

create index engagements_organization_id_idx on public.engagements (organization_id, created_at desc);
create index engagements_service_version_id_idx on public.engagements (service_version_id);
create index engagements_invitation_id_idx on public.engagements (invitation_id);
create index engagements_created_by_idx on public.engagements (created_by);
create index engagements_status_idx on public.engagements (status);

create table public.engagement_status_history (
  id            uuid primary key default public.uuidv7(),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  from_status   public.engagement_status,
  to_status     public.engagement_status not null,
  changed_by    uuid,
  changed_at    timestamptz not null default now(),
  reason        text,

  constraint engagement_status_history_reason check (reason is null or char_length(reason) <= 500)
);

comment on table public.engagement_status_history is
  'Historial de estados de cada contratación. Solo añadir. `changed_by` sin FK: sobrevive seudonimizado.';

create index engagement_status_history_engagement_idx on public.engagement_status_history (engagement_id, changed_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Máquina de estados
-- ─────────────────────────────────────────────────────────────────────────────
create function public.engagement_transition_allowed(
  p_from public.engagement_status,
  p_to public.engagement_status
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('borrador', 'invitada'), ('borrador', 'cancelada'),
    ('invitada', 'datos_completos'), ('invitada', 'cancelada'),
    ('datos_completos', 'firmada'), ('datos_completos', 'cancelada'),
    ('firmada', 'pago_en_curso'), ('firmada', 'rescindida'),
    ('pago_en_curso', 'pagada'), ('pago_en_curso', 'en_impago'), ('pago_en_curso', 'rescindida'),
    ('pagada', 'activa'), ('pagada', 'en_impago'), ('pagada', 'rescindida'),
    ('activa', 'finalizada'), ('activa', 'en_impago'), ('activa', 'rescindida'),
    ('en_impago', 'pago_en_curso'), ('en_impago', 'activa'), ('en_impago', 'rescindida')
  );
$$;

comment on function public.engagement_transition_allowed(public.engagement_status, public.engagement_status) is
  'Tabla de transiciones permitidas de una contratación (docs/ARCHITECTURE.md §20).';

create function public.engagements_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    if new.status <> 'borrador' then
      raise exception 'Una contratación nace en borrador' using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.created_at is distinct from old.created_at
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'Estos campos de una contratación no se cambian' using errcode = 'P0001';
  end if;

  -- Las condiciones solo se tocan antes de que el cliente dé sus datos: a partir
  -- de ahí van al contrato y no pueden moverse.
  if (new.service_version_id, new.price_cents, new.conditions)
     is distinct from (old.service_version_id, old.price_cents, old.conditions)
     and old.status not in ('borrador', 'invitada') then
    raise exception 'Las condiciones ya no se pueden cambiar en estado %', old.status using errcode = 'P0001';
  end if;

  if new.invitation_id is distinct from old.invitation_id
     and new.invitation_id is not null and old.status not in ('borrador', 'invitada') then
    raise exception 'La invitación solo se enlaza al principio' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not public.engagement_transition_allowed(old.status, new.status) then
      raise exception 'Transición no permitida: % → %', old.status, new.status using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.engagements_before_write() from public, anon, authenticated;

create trigger engagements_before_write
  before insert or update on public.engagements
  for each row execute function public.engagements_before_write();

create trigger engagements_set_updated_at
  before update on public.engagements
  for each row execute function public.set_updated_at();

-- Historial y registro. Definer: el historial no tiene grants de escritura.
create function public.engagements_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.engagement_status_history (engagement_id, from_status, to_status, changed_by, reason)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      (select auth.uid()),
      nullif(current_setting('excelsior.motivo', true), '')
    );
    perform public.write_audit(
      case when tg_op = 'INSERT' then 'engagement.created' else 'engagement.status_changed' end,
      new.organization_id,
      jsonb_build_object('engagement_id', new.id, 'to', new.status)
        || case when tg_op = 'INSERT' then '{}'::jsonb else jsonb_build_object('from', old.status) end);
  end if;
  return null;
end;
$$;
revoke execute on function public.engagements_after_write() from public, anon, authenticated;

create trigger engagements_after_write
  after insert or update on public.engagements
  for each row execute function public.engagements_after_write();

create function public.engagement_status_history_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'El historial de estados es de solo añadir' using errcode = 'P0001';
end;
$$;
revoke execute on function public.engagement_status_history_immutable() from public, anon, authenticated;

create trigger engagement_status_history_immutable
  before update or delete on public.engagement_status_history
  for each row execute function public.engagement_status_history_immutable();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Funciones de la app
-- ─────────────────────────────────────────────────────────────────────────────
-- Invitar a un cliente a contratar un servicio. SECURITY INVOKER: solo el staff
-- puede (RLS de engagements e invitations). Todo o nada, en una transacción.
create function public.invite_to_service(
  p_organization_id uuid,
  p_email text,
  p_service_version_id uuid,
  p_price_cents bigint default null,
  p_conditions text default null
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_token text;
  v_engagement_id uuid;
  v_invitation_id uuid;
  v_price bigint;
begin
  select v.price_cents into v_price from public.service_versions v where v.id = p_service_version_id;
  if not found then
    raise exception 'El servicio no existe' using errcode = 'P0001';
  end if;

  insert into public.engagements (organization_id, service_version_id, price_cents, conditions)
  values (p_organization_id, p_service_version_id, coalesce(p_price_cents, v_price), nullif(btrim(p_conditions), ''))
  returning id into v_engagement_id;

  v_token := public.create_invitation(p_organization_id, p_email, 'owner');
  select i.id into v_invitation_id from public.invitations i
   where i.token_hash = extensions.digest(v_token, 'sha256');

  update public.engagements set invitation_id = v_invitation_id, status = 'invitada'
   where id = v_engagement_id;

  return v_token;
end;
$$;

comment on function public.invite_to_service(uuid, text, uuid, bigint, text) is
  'Crea una contratación y la invitación para el cliente (solo staff, por RLS). Devuelve el token una vez.';
grant execute on function public.invite_to_service(uuid, text, uuid, bigint, text) to authenticated;

-- Cambiar de estado con motivo (cancelar, rescindir…). Invoker: la RLS decide
-- quién; el trigger, qué transición.
create function public.change_engagement_status(
  p_engagement_id uuid,
  p_status public.engagement_status,
  p_reason text default null
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform set_config('excelsior.motivo', coalesce(left(btrim(p_reason), 500), ''), true);
  update public.engagements set status = p_status where id = p_engagement_id;
  if not found then
    raise exception 'La contratación no existe' using errcode = 'P0001';
  end if;
  perform set_config('excelsior.motivo', '', true);
end;
$$;

comment on function public.change_engagement_status(uuid, public.engagement_status, text) is
  'Cambia el estado de una contratación con motivo. Quién: RLS. Qué transición: trigger.';
grant execute on function public.change_engagement_status(uuid, public.engagement_status, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.engagements, public.engagement_status_history from anon, authenticated;

grant select,
      insert (organization_id, service_version_id, price_cents, conditions),
      update (service_version_id, price_cents, conditions, status, invitation_id)
  on table public.engagements to authenticated;
grant select on table public.engagement_status_history to authenticated;

alter table public.engagements enable row level security;
alter table public.engagement_status_history enable row level security;

-- El cliente ve las contrataciones de sus empresas; el staff, todas.
create policy engagements_select
  on public.engagements for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

-- Crear y cambiar: el equipo. Los pasos del cliente (datos, firma, pago) se
-- harán con funciones propias en las fases 3 y 4.
create policy engagements_insert_staff
  on public.engagements for insert
  to authenticated
  with check ((select public.is_staff()));

create policy engagements_update_staff
  on public.engagements for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy engagement_status_history_select
  on public.engagement_status_history for select
  to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.engagements e
       where e.id = engagement_status_history.engagement_id and public.is_org_member(e.organization_id)
    )
  );

-- Que el cliente vea el servicio que ha contratado (y solo ese).
create policy service_versions_select_contracted
  on public.service_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.engagements e
       where e.service_version_id = service_versions.id and public.is_org_member(e.organization_id)
    )
  );

create policy services_select_contracted
  on public.services for select
  to authenticated
  using (
    exists (
      select 1 from public.service_versions v
        join public.engagements e on e.service_version_id = v.id
       where v.service_id = services.id and public.is_org_member(e.organization_id)
    )
  );
