-- =============================================================================
-- Excelsior · módulo SERVICIOS — catálogo de lo que vende R3ZON (Fase 2)
-- =============================================================================
--
-- · service_categories: tipos de servicio (desarrollo web, comercio
--   electrónico, IA…). Se amplían con filas, sin tocar código ni cobros.
-- · services: el servicio del catálogo, con su categoría. Es una PLANTILLA:
--   R3ZON trabaja con presupuestos a medida, así que una contratación copia
--   nombre, precio e IVA en sus propias líneas y los ajusta (módulo
--   contrataciones). Cambiar el catálogo nunca altera lo contratado.
-- · service_versions: precio e IVA por defecto y qué incluye. INMUTABLES:
--   cambiar un precio es crear una versión nueva.
--
-- Quién: el catálogo lo gestiona `admin` (T-12); el staff lo lee. Que un
-- cliente vea el servicio que ha contratado lo concede el módulo
-- contrataciones, que es el que sabe qué ha contratado cada uno.
--
-- Dinero: céntimos en `bigint` (nunca float). IVA en `numeric(5,2)`. Las
-- modalidades de pago no son del catálogo: cada contratación lleva sus hitos.
--
-- Depende de: plataforma, base (dinero).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.service_categories (
  id          uuid primary key default public.uuidv7(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.service_categories is
  'Tipos de servicio. Se amplían añadiendo filas (admin); la lógica de cobros no depende de ellos. Se archivan, no se borran.';

create unique index service_categories_name_unique on public.service_categories (lower(btrim(name)));

-- Las de partida (decisión de R3ZON, 2026-10-23). Son datos de referencia, no
-- de prueba: van en la migración para que existan en todos los entornos.
insert into public.service_categories (name, position) values
  ('Desarrollo web', 10),
  ('Comercio electrónico', 20),
  ('Aplicación a medida', 30),
  ('Automatizaciones', 40),
  ('Inteligencia artificial', 50),
  ('Integraciones', 60),
  ('Mantenimiento', 70),
  ('Otros servicios personalizados', 1000);

create table public.services (
  id          uuid primary key default public.uuidv7(),
  name        text not null,
  summary     text,
  category_id uuid references public.service_categories (id) on delete restrict,
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
create index services_category_id_idx on public.services (category_id);

create table public.service_versions (
  id              uuid primary key default public.uuidv7(),
  service_id      uuid not null references public.services (id) on delete restrict,
  -- Lo pone el trigger (siguiente número); el default solo existe para que no
  -- haya que mandarlo. La app no tiene permiso de escribir esta columna.
  version         integer not null default 0,
  price_cents     bigint not null,
  vat_rate        numeric(5, 2) not null default 21.00,
  includes        text[] not null default '{}',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint service_versions_unique unique (service_id, version),
  constraint service_versions_price check (price_cents >= 0 and price_cents <= 100000000000),
  constraint service_versions_vat check (vat_rate >= 0 and vat_rate <= 100),
  constraint service_versions_includes check (cardinality(includes) <= 50)
);

comment on table public.service_versions is
  'Precio por defecto (céntimos, sin IVA), IVA y qué incluye un servicio. Inmutable: cambiar = versión nueva.';

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
  select s.id, s.name, s.summary, s.category_id, s.archived_at, s.created_at,
         v.id as version_id, v.version, v.price_cents, v.vat_rate, v.includes
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
revoke all on table public.service_categories, public.services, public.service_versions, public.services_current
  from anon, authenticated;

grant select, insert (name, position), update (name, position, archived_at)
  on table public.service_categories to authenticated;
grant select, insert (name, summary, category_id), update (name, summary, category_id, archived_at)
  on table public.services to authenticated;
grant select, insert (service_id, price_cents, vat_rate, includes)
  on table public.service_versions to authenticated;
grant select on table public.services_current to authenticated;

alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_versions enable row level security;

-- Categorías: datos de referencia sin nada personal; las ve cualquiera con
-- sesión (el cliente ve la de cada línea de su contratación). Las amplía admin.
create policy service_categories_select
  on public.service_categories for select
  to authenticated
  using (true);

create policy service_categories_insert_admin
  on public.service_categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy service_categories_update_admin
  on public.service_categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

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
