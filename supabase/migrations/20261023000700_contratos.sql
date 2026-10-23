-- =============================================================================
-- Excelsior · módulo CONTRATOS — plantillas, cláusulas, contratos y firma
-- =============================================================================
--
-- Herramienta del equipo de R3ZON (decisión de R3ZON, 2026-10-23):
--   · contract_templates / _versions: plantilla con huecos {{cliente.nif}}…
--   · contract_clauses / _versions: cláusulas prediseñadas que se activan con
--     un interruptor en cada contrato.
--   · contract_annexes: anexos escritos a mano para un contrato concreto.
-- Plantillas y cláusulas se versionan y sus versiones son INMUTABLES: un
-- contrato apunta a la versión exacta que usó.
--
-- El TEXTO que se firma lo compone la BASE (contract_render): la vista previa y
-- el documento firmado salen de la misma función, así que lo que el cliente ve
-- es lo que firma. Su SHA-256 lo calcula la base al firmar.
--
-- La firma (sign_contract) exige, dentro de la base:
--   · ser propietario de la empresa (T-12, docs/ROLES.md);
--   · que la sesión haya verificado un código enviado a su email en los últimos
--     10 minutos (claim `amr` del JWT): no se puede saltar llamando a la API;
--   · aceptación expresa, firma dibujada (PNG) y datos del firmante.
-- Validez jurídica de la firma simple propia: PENDIENTE de la asesoría (D-10).
--
-- Máquina de estados del contrato (docs/ARCHITECTURE.md §20):
--   borrador ⇄ enviado ─► firmado ─► sustituido;  borrador | enviado ─► anulado
--
-- Depende de: plataforma, organizaciones, servicios, contrataciones.
-- =============================================================================

create type public.contract_status as enum ('borrador', 'enviado', 'firmado', 'anulado', 'sustituido');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Datos de R3ZON (prestador) que usan los contratos
-- ─────────────────────────────────────────────────────────────────────────────
create table public.provider_profile (
  id          boolean primary key default true check (id),
  legal_name  text not null default '' check (char_length(legal_name) <= 200),
  tax_id      text not null default '' check (char_length(tax_id) <= 20),
  address     text not null default '' check (char_length(address) <= 300),
  email       text not null default '' check (char_length(email) <= 200),
  updated_at  timestamptz not null default now()
);

comment on table public.provider_profile is
  'Datos de R3ZON como prestador (una sola fila). Huecos {{r3zon.*}} de los contratos. Los edita un admin.';

insert into public.provider_profile (id) values (true);

create trigger provider_profile_set_updated_at
  before update on public.provider_profile
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Plantillas y cláusulas (versionadas)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.contract_templates (
  id          uuid primary key default public.uuidv7(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create unique index contract_templates_name_unique on public.contract_templates (lower(btrim(name)));
create index contract_templates_created_by_idx on public.contract_templates (created_by);

create table public.contract_template_versions (
  id          uuid primary key default public.uuidv7(),
  template_id uuid not null references public.contract_templates (id) on delete restrict,
  version     integer not null default 0,
  body        text not null check (char_length(body) between 1 and 100000),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (template_id, version)
);
create index contract_template_versions_created_by_idx on public.contract_template_versions (created_by);

create table public.contract_clauses (
  id          uuid primary key default public.uuidv7(),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 500),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
create unique index contract_clauses_title_unique on public.contract_clauses (lower(btrim(title)));
create index contract_clauses_created_by_idx on public.contract_clauses (created_by);

create table public.contract_clause_versions (
  id          uuid primary key default public.uuidv7(),
  clause_id   uuid not null references public.contract_clauses (id) on delete restrict,
  version     integer not null default 0,
  body        text not null check (char_length(body) between 1 and 50000),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (clause_id, version)
);
create index contract_clause_versions_created_by_idx on public.contract_clause_versions (created_by);

comment on table public.contract_templates is 'Plantilla de contrato. Su texto va en versiones inmutables.';
comment on table public.contract_clauses is 'Cláusula prediseñada (subplantilla). Su texto va en versiones inmutables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Huecos y formato
-- ─────────────────────────────────────────────────────────────────────────────
-- Lista CERRADA de huecos. Un texto con un hueco desconocido no se guarda. La
-- interfaz repite la lista y un test comprueba que coinciden.
create function public.contract_placeholder_names()
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select array[
    'cliente.razon_social', 'cliente.nif', 'cliente.direccion', 'cliente.tipo', 'cliente.email_facturacion',
    'firmante.nombre', 'firmante.dni', 'firmante.cargo', 'firmante.email',
    'servicio.nombre', 'servicio.resumen', 'servicio.incluye', 'servicio.version',
    'precio.base', 'precio.iva_porcentaje', 'precio.iva', 'precio.total', 'precio.modalidad',
    'contrato.condiciones', 'contrato.fecha', 'contrato.referencia',
    'r3zon.razon_social', 'r3zon.nif', 'r3zon.direccion', 'r3zon.email'
  ];
$$;

-- Huecos de un texto que no están en la lista.
create function public.contract_unknown_placeholders(p_body text)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(distinct m[1] order by m[1]), '{}')
    from regexp_matches(p_body, '\{\{\s*([^}\s]+)\s*\}\}', 'g') m
   where not (m[1] = any (public.contract_placeholder_names()));
$$;

-- 150000 → «1.500,00 €».
create function public.format_eur(p_cents bigint)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when p_cents < 0 then '-' else '' end
      || regexp_replace((abs(p_cents) / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
      || ',' || lpad((abs(p_cents) % 100)::text, 2, '0') || ' €';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Contratos de cada contratación
-- ─────────────────────────────────────────────────────────────────────────────
create table public.contracts (
  id                  uuid primary key default public.uuidv7(),
  engagement_id       uuid not null references public.engagements (id) on delete restrict,
  organization_id     uuid not null references public.organizations (id) on delete restrict,
  template_version_id uuid not null references public.contract_template_versions (id) on delete restrict,
  status              public.contract_status not null default 'borrador',
  delegated_email     text check (delegated_email is null or delegated_email ~ '^[^@\s]+@[^@\s]+$'),
  signed_text         text,
  text_sha256         bytea,
  sent_at             timestamptz,
  signed_at           timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint contracts_signed_consistency check (
    (status in ('firmado', 'sustituido')) = (signed_text is not null and text_sha256 is not null and signed_at is not null)
  )
);

comment on table public.contracts is
  'Contrato de una contratación. El texto firmado y su SHA-256 los fija sign_contract. Se conserva 6 años.';

create index contracts_engagement_id_idx on public.contracts (engagement_id);
create index contracts_organization_id_idx on public.contracts (organization_id);
create index contracts_template_version_id_idx on public.contracts (template_version_id);
create index contracts_created_by_idx on public.contracts (created_by);
-- Un solo contrato vivo por contratación.
create unique index contracts_one_live_per_engagement on public.contracts (engagement_id)
  where status in ('borrador', 'enviado', 'firmado');

create table public.contract_clause_selections (
  contract_id       uuid not null references public.contracts (id) on delete restrict,
  clause_version_id uuid not null references public.contract_clause_versions (id) on delete restrict,
  position          smallint not null default 0,
  primary key (contract_id, clause_version_id)
);
create index contract_clause_selections_clause_version_idx on public.contract_clause_selections (clause_version_id);

create table public.contract_annexes (
  id          uuid primary key default public.uuidv7(),
  contract_id uuid not null references public.contracts (id) on delete restrict,
  position    smallint not null default 0,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  body        text not null check (char_length(body) between 1 and 50000),
  created_at  timestamptz not null default now()
);
create index contract_annexes_contract_idx on public.contract_annexes (contract_id, position);

create table public.contract_signatures (
  id               uuid primary key default public.uuidv7(),
  contract_id      uuid not null unique references public.contracts (id) on delete restrict,
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  -- Sin FK, como en audit_log: la evidencia sobrevive a la supresión de la cuenta.
  signer_user_id   uuid not null,
  signer_name      text not null,
  signer_tax_id    text not null,
  signer_role      text not null,
  signer_email     text not null,
  signature_png    bytea not null,
  signature_sha256 bytea not null,
  text_sha256      bytea not null,
  otp_verified_at  timestamptz not null,
  signed_at        timestamptz not null default now(),
  ip               text,
  user_agent       text
);

comment on table public.contract_signatures is
  'Evidencias de la firma: firmante, firma dibujada, huellas SHA-256, verificación por código, fecha, IP y agente. Inmutable.';

create index contract_signatures_organization_idx on public.contract_signatures (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Reglas (triggers)
-- ─────────────────────────────────────────────────────────────────────────────
create function public.contracts_catalog_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  if tg_table_name = 'contract_template_versions' then
    perform 1 from public.contract_templates t where t.id = new.template_id for update;
    select coalesce(max(v.version), 0) + 1 into new.version
      from public.contract_template_versions v where v.template_id = new.template_id;
  elsif tg_table_name = 'contract_clause_versions' then
    perform 1 from public.contract_clauses c where c.id = new.clause_id for update;
    select coalesce(max(v.version), 0) + 1 into new.version
      from public.contract_clause_versions v where v.clause_id = new.clause_id;
  end if;
  -- IF anidado: `new.body` no existe en las tablas sin versión, y PL/pgSQL no
  -- garantiza el orden de un AND (ver strip_invitation_token).
  if tg_table_name in ('contract_template_versions', 'contract_clause_versions') then
    if cardinality(public.contract_unknown_placeholders(new.body)) > 0 then
      raise exception 'Huecos desconocidos: %', array_to_string(public.contract_unknown_placeholders(new.body), ', ')
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.contracts_catalog_before_insert() from public, anon, authenticated;

create trigger contract_templates_before_insert before insert on public.contract_templates
  for each row execute function public.contracts_catalog_before_insert();
create trigger contract_clauses_before_insert before insert on public.contract_clauses
  for each row execute function public.contracts_catalog_before_insert();
create trigger contract_template_versions_before_insert before insert on public.contract_template_versions
  for each row execute function public.contracts_catalog_before_insert();
create trigger contract_clause_versions_before_insert before insert on public.contract_clause_versions
  for each row execute function public.contracts_catalog_before_insert();

create trigger contract_templates_set_updated_at before update on public.contract_templates
  for each row execute function public.set_updated_at();
create trigger contract_clauses_set_updated_at before update on public.contract_clauses
  for each row execute function public.set_updated_at();

-- Versiones, firmas: inmutables.
create function public.contracts_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% no se modifica ni se borra', tg_table_name using errcode = 'P0001';
end;
$$;
revoke execute on function public.contracts_immutable() from public, anon, authenticated;

create trigger contract_template_versions_immutable before update or delete on public.contract_template_versions
  for each row execute function public.contracts_immutable();
create trigger contract_clause_versions_immutable before update or delete on public.contract_clause_versions
  for each row execute function public.contracts_immutable();
create trigger contract_signatures_immutable before update or delete on public.contract_signatures
  for each row execute function public.contracts_immutable();

create function public.contract_transition_allowed(p_from public.contract_status, p_to public.contract_status)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('borrador', 'enviado'), ('enviado', 'borrador'),
    ('borrador', 'anulado'), ('enviado', 'anulado'),
    ('enviado', 'firmado'), ('firmado', 'sustituido')
  );
$$;

create function public.contracts_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_engagement public.engagements;
begin
  if tg_op = 'INSERT' then
    select * into v_engagement from public.engagements e where e.id = new.engagement_id;
    if not found then
      raise exception 'La contratación no existe' using errcode = 'P0001';
    end if;
    if v_engagement.status not in ('borrador', 'invitada', 'datos_completos') then
      raise exception 'Esta contratación ya no admite un contrato nuevo (estado %)', v_engagement.status
        using errcode = 'P0001';
    end if;
    if not v_engagement.requires_signature then
      raise exception 'Esta contratación no se firma en el portal (activa «firma en el portal» para prepararle un contrato)'
        using errcode = 'P0001';
    end if;
    new.organization_id := v_engagement.organization_id;
    new.created_by := (select auth.uid());
    if new.status <> 'borrador' or new.signed_text is not null or new.text_sha256 is not null then
      raise exception 'Un contrato nace en borrador' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if (new.engagement_id, new.organization_id, new.created_at)
     is distinct from (old.engagement_id, old.organization_id, old.created_at) then
    raise exception 'Estos campos de un contrato no se cambian' using errcode = 'P0001';
  end if;
  if old.status <> 'borrador' and new.template_version_id is distinct from old.template_version_id then
    raise exception 'La plantilla solo se cambia en borrador' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not public.contract_transition_allowed(old.status, new.status) then
      raise exception 'Transición no permitida: % → %', old.status, new.status using errcode = 'P0001';
    end if;
    -- Firmar solo desde sign_contract (que comprueba firmante, código y datos).
    if new.status = 'firmado' and current_setting('excelsior.firmando', true) is distinct from 'on' then
      raise exception 'Un contrato solo se firma con sign_contract' using errcode = 'P0001';
    end if;
    if new.status = 'enviado' then
      new.sent_at := now();
    end if;
  end if;

  -- Lo firmado no se toca (salvo pasar a sustituido).
  if old.status in ('firmado', 'sustituido')
     and (new.signed_text, new.text_sha256, new.signed_at, new.delegated_email)
         is distinct from (old.signed_text, old.text_sha256, old.signed_at, old.delegated_email) then
    raise exception 'Un contrato firmado no se modifica' using errcode = 'P0001';
  end if;
  if old.status not in ('firmado', 'sustituido') and new.status not in ('firmado', 'sustituido')
     and (new.signed_text is not null or new.text_sha256 is not null) then
    raise exception 'El texto firmado solo lo fija sign_contract' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.contracts_before_write() from public, anon, authenticated;

create trigger contracts_before_write
  before insert or update on public.contracts
  for each row execute function public.contracts_before_write();

create function public.contracts_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('contract.created', new.organization_id, jsonb_build_object('contract_id', new.id));
  elsif new.status is distinct from old.status then
    perform public.write_audit('contract.' || new.status::text, new.organization_id,
      jsonb_build_object('contract_id', new.id, 'from', old.status));
  elsif new.delegated_email is distinct from old.delegated_email then
    perform public.write_audit('contract.delegated', new.organization_id, jsonb_build_object('contract_id', new.id));
  end if;
  return null;
end;
$$;
revoke execute on function public.contracts_audit() from public, anon, authenticated;

create trigger contracts_audit
  after insert or update on public.contracts
  for each row execute function public.contracts_audit();

-- Cláusulas activadas y anexos: solo mientras el contrato está en borrador.
create function public.contract_parts_only_in_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract uuid := case when tg_op = 'DELETE' then old.contract_id else new.contract_id end;
begin
  if tg_op = 'UPDATE' and new.contract_id is distinct from old.contract_id then
    raise exception 'No se mueve de contrato' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contracts c where c.id = v_contract and c.status = 'borrador') then
    raise exception 'El contrato ya no está en borrador: no se puede cambiar' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.contract_parts_only_in_draft() from public, anon, authenticated;

create trigger contract_clause_selections_only_in_draft
  before insert or update or delete on public.contract_clause_selections
  for each row execute function public.contract_parts_only_in_draft();
create trigger contract_annexes_only_in_draft
  before insert or update or delete on public.contract_annexes
  for each row execute function public.contract_parts_only_in_draft();

-- Anexos: también sin huecos desconocidos.
create function public.contract_annexes_check_placeholders()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if cardinality(public.contract_unknown_placeholders(new.body)) > 0 then
    raise exception 'Huecos desconocidos: %', array_to_string(public.contract_unknown_placeholders(new.body), ', ')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.contract_annexes_check_placeholders() from public, anon, authenticated;

create trigger contract_annexes_check_placeholders
  before insert or update on public.contract_annexes
  for each row execute function public.contract_annexes_check_placeholders();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Composición del texto
-- ─────────────────────────────────────────────────────────────────────────────
-- Valores de los huecos para un contrato. SECURITY INVOKER: con la sesión del
-- cliente, la RLS solo le deja componer contratos de su empresa.
create function public.contract_variables(p_contract_id uuid, p_signer jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'cliente.razon_social', b.legal_name,
    'cliente.nif', b.tax_id,
    'cliente.direccion', concat_ws(', ', b.address, b.postal_code || ' ' || b.city, b.province, b.country),
    'cliente.tipo', case b.entity_type when 'autonomo' then 'persona física (autónomo)' when 'empresa' then 'persona jurídica' end,
    'cliente.email_facturacion', b.billing_email,
    'firmante.nombre', p_signer ->> 'nombre',
    'firmante.dni', p_signer ->> 'dni',
    'firmante.cargo', p_signer ->> 'cargo',
    'firmante.email', p_signer ->> 'email',
    'servicio.nombre', s.name,
    'servicio.resumen', s.summary,
    'servicio.incluye', case when cardinality(sv.includes) > 0
                          then '- ' || array_to_string(sv.includes, E'\n- ') end,
    'servicio.version', sv.version::text,
    'precio.base', public.format_eur(e.price_cents),
    'precio.iva_porcentaje', replace(to_char(sv.vat_rate, 'FM990.00'), '.', ',') || ' %',
    'precio.iva', public.format_eur(round(e.price_cents * sv.vat_rate / 100)::bigint),
    'precio.total', public.format_eur(e.price_cents + round(e.price_cents * sv.vat_rate / 100)::bigint),
    'precio.modalidad', case e.payment_plan
        when 'pago_unico' then 'pago único'
        when 'senal_entrega' then format('señal del %s %% (%s) al inicio y el resto (%s) a la entrega',
          sv.deposit_percent,
          public.format_eur(round((e.price_cents + round(e.price_cents * sv.vat_rate / 100)) * sv.deposit_percent / 100.0)::bigint),
          public.format_eur(e.price_cents + round(e.price_cents * sv.vat_rate / 100)::bigint
            - round((e.price_cents + round(e.price_cents * sv.vat_rate / 100)) * sv.deposit_percent / 100.0)::bigint))
      end,
    'contrato.condiciones', coalesce(nullif(btrim(e.conditions), ''), 'Ninguna.'),
    'contrato.fecha', to_char(now() at time zone 'Europe/Madrid', 'DD/MM/YYYY'),
    'contrato.referencia', upper(left(replace(c.id::text, '-', ''), 12)),
    'r3zon.razon_social', nullif(pp.legal_name, ''),
    'r3zon.nif', nullif(pp.tax_id, ''),
    'r3zon.direccion', nullif(pp.address, ''),
    'r3zon.email', nullif(pp.email, '')
  ) into v
    from public.contracts c
    join public.engagements e on e.id = c.engagement_id
    join public.service_versions sv on sv.id = e.service_version_id
    join public.services s on s.id = sv.service_id
    left join public.organization_billing b on b.organization_id = c.organization_id
    left join public.provider_profile pp on true
   where c.id = p_contract_id;
  return v;
end;
$$;

-- Texto completo de un contrato: plantilla + cláusulas activadas + anexos, con
-- los huecos rellenos. Un hueco sin valor queda como «[pendiente: x]», y no se
-- puede firmar un texto con huecos pendientes. Null si no puede leerlo.
create function public.contract_render(p_contract_id uuid, p_signer jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_text text;
  v_vars jsonb := public.contract_variables(p_contract_id, p_signer);
  v_name text;
begin
  if v_vars is null then
    return null;
  end if;

  select tv.body
         || coalesce((
              select string_agg(E'\n\n## ' || cl.title || E'\n\n' || cv.body, '' order by s.position, cl.title)
                from public.contract_clause_selections s
                join public.contract_clause_versions cv on cv.id = s.clause_version_id
                join public.contract_clauses cl on cl.id = cv.clause_id
               where s.contract_id = c.id), '')
         || coalesce((
              select string_agg(E'\n\n## Anexo ' || n || '. ' || a.title || E'\n\n' || a.body, '' order by n)
                from (select a.*, row_number() over (order by a.position, a.created_at) as n
                        from public.contract_annexes a where a.contract_id = c.id) a), '')
    into v_text
    from public.contracts c
    join public.contract_template_versions tv on tv.id = c.template_version_id
   where c.id = p_contract_id;

  if v_text is null then
    return null;
  end if;

  foreach v_name in array public.contract_placeholder_names() loop
    v_text := regexp_replace(
      v_text,
      '\{\{\s*' || replace(v_name, '.', '\.') || '\s*\}\}',
      replace(coalesce(nullif(btrim(v_vars ->> v_name), ''), '[pendiente: ' || v_name || ']'), '\', '\\'),
      'g');
  end loop;
  return v_text;
end;
$$;

comment on function public.contract_render(uuid, jsonb) is
  'Texto del contrato con los huecos rellenos. La vista previa y la firma usan esta misma función.';

revoke execute on function public.contract_placeholder_names(), public.contract_unknown_placeholders(text),
  public.format_eur(bigint), public.contract_transition_allowed(public.contract_status, public.contract_status),
  public.contract_variables(uuid, jsonb), public.contract_render(uuid, jsonb)
  from public, anon;
grant execute on function public.contract_placeholder_names(), public.contract_unknown_placeholders(text),
  public.format_eur(bigint), public.contract_transition_allowed(public.contract_status, public.contract_status),
  public.contract_variables(uuid, jsonb), public.contract_render(uuid, jsonb)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Firma
-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Ha verificado la sesión actual un código enviado a su email en los últimos
-- `p_seconds`? Lo dice el JWT (claim `amr`, método «otp»), que firma Supabase
-- Auth: el cliente no puede inventarlo.
create function public.session_otp_verified_at(p_seconds integer default 600)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select to_timestamp(max((a ->> 'timestamp')::bigint))
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
   where a ->> 'method' = 'otp'
     and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_seconds;
$$;
revoke execute on function public.session_otp_verified_at(integer) from public, anon;
grant execute on function public.session_otp_verified_at(integer) to authenticated;

create function public.sign_contract(
  p_contract_id uuid,
  p_signer_name text,
  p_signer_tax_id text,
  p_signer_role text,
  p_signature_png_base64 text,
  p_accepted boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_contract public.contracts;
  v_uid uuid := (select auth.uid());
  v_email text;
  v_otp timestamptz;
  v_png bytea;
  v_name text := btrim(coalesce(p_signer_name, ''));
  v_tax text := upper(regexp_replace(coalesce(p_signer_tax_id, ''), '[\s.-]', '', 'g'));
  v_role text := btrim(coalesce(p_signer_role, ''));
  v_signer jsonb;
  v_text text;
  v_hash bytea;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'Hace falta sesión' using errcode = '42501';
  end if;
  select * into v_contract from public.contracts c where c.id = p_contract_id for update;
  if not found or not public.is_org_member(v_contract.organization_id) then
    raise exception 'El contrato no existe' using errcode = 'P0001';
  end if;
  if public.org_role_of(v_contract.organization_id) <> 'owner' then
    raise exception 'Solo un propietario de la empresa puede firmar' using errcode = '42501';
  end if;
  if v_contract.status <> 'enviado' then
    raise exception 'Este contrato no está pendiente de firma' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.engagements e
                  where e.id = v_contract.engagement_id and e.status = 'datos_completos') then
    raise exception 'Primero hay que confirmar los datos de la empresa' using errcode = 'P0001';
  end if;
  if p_accepted is not true then
    raise exception 'Hay que aceptar el contrato expresamente' using errcode = 'P0001';
  end if;
  v_otp := public.session_otp_verified_at(600);
  if v_otp is null then
    raise exception 'Confirma la firma con el código que te hemos enviado por email' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 3 and 120 then
    raise exception 'Escribe tu nombre completo' using errcode = 'P0001';
  end if;
  if v_tax !~ '^[A-Z0-9]{8,14}$' then
    raise exception 'Escribe un DNI o NIE válido' using errcode = 'P0001';
  end if;
  if char_length(v_role) not between 2 and 100 then
    raise exception 'Escribe tu cargo en la empresa' using errcode = 'P0001';
  end if;
  begin
    v_png := decode(regexp_replace(coalesce(p_signature_png_base64, ''), '^data:image/png;base64,', ''), 'base64');
  exception when others then
    raise exception 'La firma no es válida' using errcode = 'P0001';
  end;
  if v_png is null or octet_length(v_png) not between 100 and 300000
     or substring(v_png from 1 for 8) <> '\x89504e470d0a1a0a'::bytea then
    raise exception 'Dibuja tu firma' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  v_signer := jsonb_build_object('nombre', v_name, 'dni', v_tax, 'cargo', v_role, 'email', v_email);
  v_text := public.contract_render(p_contract_id, v_signer);
  if v_text is null or v_text like '%[pendiente: %' then
    raise exception 'Faltan datos para completar el contrato' using errcode = 'P0001';
  end if;
  v_hash := extensions.digest(v_text, 'sha256');

  perform set_config('excelsior.firmando', 'on', true);
  update public.contracts
     set status = 'firmado', signed_text = v_text, text_sha256 = v_hash, signed_at = now()
   where id = p_contract_id;
  perform set_config('excelsior.firmando', 'off', true);

  insert into public.contract_signatures (
    contract_id, organization_id, signer_user_id, signer_name, signer_tax_id, signer_role, signer_email,
    signature_png, signature_sha256, text_sha256, otp_verified_at, ip, user_agent)
  values (
    p_contract_id, v_contract.organization_id, v_uid, v_name, v_tax, v_role, v_email,
    v_png, extensions.digest(v_png, 'sha256'), v_hash, v_otp,
    left(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), 64),
    left(v_headers ->> 'user-agent', 300));

  update public.engagements set status = 'firmada' where id = v_contract.engagement_id;
  return encode(v_hash, 'hex');
end;
$$;

comment on function public.sign_contract(uuid, text, text, text, text, boolean) is
  'Firma un contrato enviado: propietario, código de email verificado (<10 min), aceptación y firma dibujada. Devuelve el SHA-256.';
revoke execute on function public.sign_contract(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.sign_contract(uuid, text, text, text, text, boolean) to authenticated;

-- Delegar la firma (D-12): quien gestiona el alta y no es el firmante envía el
-- contrato a otra persona de su empresa, que recibe una invitación como
-- propietaria. Definer: un cliente no puede crear invitaciones (RLS); las
-- condiciones van dentro. Devuelve el token una vez.
create function public.delegate_contract_signature(p_contract_id uuid, p_email text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_contract public.contracts;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  select * into v_contract from public.contracts c where c.id = p_contract_id for update;
  if not found or not public.is_org_member(v_contract.organization_id) then
    raise exception 'El contrato no existe' using errcode = 'P0001';
  end if;
  if public.org_role_of(v_contract.organization_id) not in ('owner', 'billing') then
    raise exception 'Solo el propietario o facturación pueden enviar el contrato a firmar' using errcode = '42501';
  end if;
  if v_contract.status <> 'enviado' then
    raise exception 'Este contrato no está pendiente de firma' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Escribe un email válido' using errcode = 'P0001';
  end if;
  v_token := public.create_invitation(v_contract.organization_id, v_email, 'owner');
  update public.contracts set delegated_email = v_email where id = p_contract_id;
  return v_token;
end;
$$;

comment on function public.delegate_contract_signature(uuid, text) is
  'Envía el contrato a otra persona de la empresa para que lo firme (invitación como propietaria). D-12.';
revoke execute on function public.delegate_contract_signature(uuid, text) from public, anon;
grant execute on function public.delegate_contract_signature(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.provider_profile, public.contract_templates, public.contract_template_versions,
  public.contract_clauses, public.contract_clause_versions, public.contracts,
  public.contract_clause_selections, public.contract_annexes, public.contract_signatures
  from anon, authenticated;

grant select, update (legal_name, tax_id, address, email) on table public.provider_profile to authenticated;
grant select, insert (name, description), update (name, description, archived_at)
  on table public.contract_templates to authenticated;
grant select, insert (template_id, body) on table public.contract_template_versions to authenticated;
grant select, insert (title, description), update (title, description, archived_at)
  on table public.contract_clauses to authenticated;
grant select, insert (clause_id, body) on table public.contract_clause_versions to authenticated;
grant select, insert (engagement_id, template_version_id), update (template_version_id, status)
  on table public.contracts to authenticated;
grant select, insert (contract_id, clause_version_id, position), update (position), delete
  on table public.contract_clause_selections to authenticated;
grant select, insert (contract_id, position, title, body), update (position, title, body), delete
  on table public.contract_annexes to authenticated;
grant select on table public.contract_signatures to authenticated;

alter table public.provider_profile enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_template_versions enable row level security;
alter table public.contract_clauses enable row level security;
alter table public.contract_clause_versions enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_clause_selections enable row level security;
alter table public.contract_annexes enable row level security;
alter table public.contract_signatures enable row level security;

-- ¿Puede el usuario actual ver este contrato como cliente? (miembro y ya enviado)
create function public.contract_visible_to_client(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
     where c.id = p_contract_id and c.status <> 'borrador' and public.is_org_member(c.organization_id)
  );
$$;
comment on function public.contract_visible_to_client(uuid) is
  'true si el usuario es miembro de la empresa del contrato y ya no es un borrador. Para policies.';
revoke execute on function public.contract_visible_to_client(uuid) from public, anon;
grant execute on function public.contract_visible_to_client(uuid) to authenticated;

-- Datos de R3ZON: los lee cualquiera con sesión (salen en los contratos); los edita un admin.
create policy provider_profile_select on public.provider_profile for select to authenticated using (true);
create policy provider_profile_update_admin on public.provider_profile for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Catálogo de plantillas y cláusulas: staff lee, admin escribe. El cliente ve
-- solo las versiones de SUS contratos enviados.
create policy contract_templates_select on public.contract_templates for select to authenticated
  using ((select public.is_staff()));
create policy contract_templates_insert on public.contract_templates for insert to authenticated
  with check ((select public.is_admin()));
create policy contract_templates_update on public.contract_templates for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy contract_template_versions_select on public.contract_template_versions for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.contracts c
                where c.template_version_id = contract_template_versions.id
                  and public.contract_visible_to_client(c.id))
  );
create policy contract_template_versions_insert on public.contract_template_versions for insert to authenticated
  with check ((select public.is_admin()));

create policy contract_clauses_select on public.contract_clauses for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.contract_clause_versions cv
                 join public.contract_clause_selections s on s.clause_version_id = cv.id
                where cv.clause_id = contract_clauses.id and public.contract_visible_to_client(s.contract_id))
  );
create policy contract_clauses_insert on public.contract_clauses for insert to authenticated
  with check ((select public.is_admin()));
create policy contract_clauses_update on public.contract_clauses for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy contract_clause_versions_select on public.contract_clause_versions for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.contract_clause_selections s
                where s.clause_version_id = contract_clause_versions.id
                  and public.contract_visible_to_client(s.contract_id))
  );
create policy contract_clause_versions_insert on public.contract_clause_versions for insert to authenticated
  with check ((select public.is_admin()));

-- Contratos: el staff los prepara (cualquier staff: es su trabajo con el
-- cliente); el cliente los ve cuando dejan de ser borrador.
create policy contracts_select on public.contracts for select to authenticated
  using ((select public.is_staff()) or public.contract_visible_to_client(id));
create policy contracts_insert_staff on public.contracts for insert to authenticated
  with check ((select public.is_staff()));
create policy contracts_update_staff on public.contracts for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy contract_clause_selections_select on public.contract_clause_selections for select to authenticated
  using ((select public.is_staff()) or public.contract_visible_to_client(contract_id));
create policy contract_clause_selections_write on public.contract_clause_selections for insert to authenticated
  with check ((select public.is_staff()));
create policy contract_clause_selections_update on public.contract_clause_selections for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy contract_clause_selections_delete on public.contract_clause_selections for delete to authenticated
  using ((select public.is_staff()));

create policy contract_annexes_select on public.contract_annexes for select to authenticated
  using ((select public.is_staff()) or public.contract_visible_to_client(contract_id));
create policy contract_annexes_insert on public.contract_annexes for insert to authenticated
  with check ((select public.is_staff()));
create policy contract_annexes_update on public.contract_annexes for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy contract_annexes_delete on public.contract_annexes for delete to authenticated
  using ((select public.is_staff()));

create policy contract_signatures_select on public.contract_signatures for select to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));
