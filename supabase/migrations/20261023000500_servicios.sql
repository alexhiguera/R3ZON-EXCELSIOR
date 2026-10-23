-- =============================================================================
-- Excelsior · módulo SERVICIOS — catálogo de lo que vende R3ZON (Fase 2)
-- =============================================================================
--
-- · services: el servicio (web corporativa, ecommerce, mantenimiento…).
-- · service_versions: sus condiciones comerciales (precio, IVA, modalidades de
--   pago, qué incluye). INMUTABLES: cambiar un precio es crear una versión
--   nueva. Una contratación apunta a una versión concreta, así que cambiar el
--   catálogo nunca altera lo ya contratado (docs/PLAN.md, Fase 2).
--
-- Quién: el catálogo lo gestiona `admin` (T-12); el staff lo lee. Que un
-- cliente vea el servicio que ha contratado lo concede el módulo
-- contrataciones, que es el que sabe qué ha contratado cada uno.
--
-- Dinero: céntimos en `bigint` (nunca float). IVA en `numeric(5,2)`.
--
-- Depende de: plataforma.
-- =============================================================================

create type public.payment_plan as enum ('pago_unico', 'senal_entrega');

comment on type public.payment_plan is
  'Modalidad de pago: pago único, o señal al firmar + resto a la entrega (T-05).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.services (
  id          uuid primary key default public.uuidv7(),
  name        text not null,
  summary     text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,

  constraint services_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint services_summary_length check (summary is null or char_length(summary) <= 500)
);

comment on table public.services is
  'Servicio del catálogo de R3ZON. Sus condiciones van en service_versions. Se archiva, no se borra.';

create unique index services_name_unique on public.services (lower(btrim(name)));
create index services_created_by_idx on public.services (created_by);

create table public.service_versions (
  id              uuid primary key default public.uuidv7(),
  service_id      uuid not null references public.services (id) on delete restrict,
  -- Lo pone el trigger (siguiente número); el default solo existe para que no
  -- haya que mandarlo. La app no tiene permiso de escribir esta columna.
  version         integer not null default 0,
  price_cents     bigint not null,
  vat_rate        numeric(5, 2) not null default 21.00,
  payment_plans   public.payment_plan[] not null default array['pago_unico']::public.payment_plan[],
  deposit_percent smallint,
  includes        text[] not null default '{}',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint service_versions_unique unique (service_id, version),
  constraint service_versions_price check (price_cents >= 0 and price_cents <= 100000000000),
  constraint service_versions_vat check (vat_rate >= 0 and vat_rate <= 100),
  constraint service_versions_plans check (cardinality(payment_plans) >= 1),
  -- La señal existe si y solo si se ofrece «señal + entrega». Escrita para que
  -- nunca valga NULL: un CHECK que evalúa a NULL se da por cumplido, y
  -- `x and null between 1 and 99` es NULL (dejaba pasar una señal vacía).
  constraint service_versions_deposit check (
    case
      when 'senal_entrega' = any (payment_plans)
        then coalesce(deposit_percent between 1 and 99, false)
      else deposit_percent is null
    end
  ),
  constraint service_versions_includes check (cardinality(includes) <= 50)
);

comment on table public.service_versions is
  'Condiciones comerciales de un servicio. Inmutable: cambiar = versión nueva. Precio en céntimos sin IVA.';

create index service_versions_created_by_idx on public.service_versions (created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reglas (triggers)
-- ─────────────────────────────────────────────────────────────────────────────
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create function public.catalog_set_created_by()
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
revoke execute on function public.catalog_set_created_by() from public, anon, authenticated;

create trigger services_set_created_by
  before insert on public.services
  for each row execute function public.catalog_set_created_by();

-- Número de versión: siguiente al último del servicio, lo pone la base.
-- Bloqueo del servicio para que dos versiones simultáneas no choquen.
create function public.service_versions_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  perform 1 from public.services s where s.id = new.service_id for update;
  select coalesce(max(v.version), 0) + 1 into new.version
    from public.service_versions v where v.service_id = new.service_id;
  -- Sin duplicados ni vacíos en «qué incluye».
  new.includes := array(
    select distinct btrim(x) from unnest(new.includes) x where btrim(x) <> '' order by 1
  );
  return new;
end;
$$;
revoke execute on function public.service_versions_before_insert() from public, anon, authenticated;

create trigger service_versions_before_insert
  before insert on public.service_versions
  for each row execute function public.service_versions_before_insert();

create function public.service_versions_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Una versión de servicio no se modifica: crea una nueva' using errcode = 'P0001';
end;
$$;
revoke execute on function public.service_versions_immutable() from public, anon, authenticated;

create trigger service_versions_immutable
  before update or delete on public.service_versions
  for each row execute function public.service_versions_immutable();

create function public.catalog_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'services' then
    if tg_op = 'INSERT' then
      perform public.write_audit('service.created', null, jsonb_build_object('service_id', new.id));
    elsif new.archived_at is distinct from old.archived_at then
      perform public.write_audit(
        case when new.archived_at is null then 'service.unarchived' else 'service.archived' end,
        null, jsonb_build_object('service_id', new.id));
    end if;
  else
    perform public.write_audit('service.version_created', null,
      jsonb_build_object('service_id', new.service_id, 'version', new.version, 'price_cents', new.price_cents));
  end if;
  return null;
end;
$$;
revoke execute on function public.catalog_audit() from public, anon, authenticated;

create trigger services_audit
  after insert or update of archived_at on public.services
  for each row execute function public.catalog_audit();

create trigger service_versions_audit
  after insert on public.service_versions
  for each row execute function public.catalog_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vista de la versión vigente
-- ─────────────────────────────────────────────────────────────────────────────
-- security_invoker: la vista aplica la RLS de quien consulta, no la de su dueño.
create view public.services_current
with (security_invoker = true) as
  select s.id, s.name, s.summary, s.archived_at, s.created_at,
         v.id as version_id, v.version, v.price_cents, v.vat_rate, v.payment_plans,
         v.deposit_percent, v.includes
    from public.services s
    left join lateral (
      select * from public.service_versions sv
       where sv.service_id = s.id
       order by sv.version desc
       limit 1
    ) v on true;

comment on view public.services_current is
  'Cada servicio con su versión vigente (la última). security_invoker: respeta la RLS de quien consulta.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.services, public.service_versions, public.services_current from anon, authenticated;

grant select, insert (name, summary), update (name, summary, archived_at) on table public.services to authenticated;
grant select, insert (service_id, price_cents, vat_rate, payment_plans, deposit_percent, includes)
  on table public.service_versions to authenticated;
grant select on table public.services_current to authenticated;

alter table public.services enable row level security;
alter table public.service_versions enable row level security;

create policy services_select_staff
  on public.services for select
  to authenticated
  using ((select public.is_staff()));

create policy services_insert_admin
  on public.services for insert
  to authenticated
  with check ((select public.is_admin()));

create policy services_update_admin
  on public.services for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy service_versions_select_staff
  on public.service_versions for select
  to authenticated
  using ((select public.is_staff()));

create policy service_versions_insert_admin
  on public.service_versions for insert
  to authenticated
  with check ((select public.is_admin()));
