-- =============================================================================
-- Excelsior · módulo CONTRATACIONES — lo que un cliente contrata y en qué
-- condiciones económicas
-- =============================================================================
--
-- · engagements: la contratación. Lleva el estado CONTRACTUAL; el económico va
--   aparte (módulo cobros). Dato con obligación de conservación (6 años):
--   `on delete restrict` hacia la organización y no se borra desde la app.
-- · engagement_revisions: las CONDICIONES ECONÓMICAS de la contratación, por
--   revisiones. La vigente es `engagements.current_revision_id`.
-- · engagement_lines: los servicios de una revisión (uno o varios), cada uno
--   con su categoría, nombre, descripción, precio, descuento e IVA.
-- · engagement_milestones: cómo se paga el total (hitos).
-- · engagement_status_history: cada cambio de estado, quién y cuándo.
--
-- Dinero (módulo base dinero): céntimos `bigint`; porcentajes `numeric(5,2)`.
-- Lo calcula la BASE y lo guarda en las propias filas: el navegador nunca
-- dice cuánto vale nada.
--   · Línea: descuento (en % con money_percent, o en importe) y base =
--     precio − descuento. El descuento nunca supera el precio.
--   · Revisión: IVA por tipo sobre la suma de las bases de ese tipo, un solo
--     redondeo por tipo; total = bases + cuotas. Desglose en `taxes`.
--   · Hitos: importe fijo o peso; lo que queda tras los fijos se reparte por
--     pesos con money_split. Los importes suman exactamente el total, o la
--     revisión no es válida (`milestones_valid`) y no se puede invitar,
--     aceptar ni proponer. Sin hitos: un único pago del total.
--
-- Revisiones (decisión de R3ZON, 2026-10-23):
--
--   borrador ─(el cliente da sus datos)─► aceptada ─► sustituida
--   cambio: borrador ⇄ propuesta ─(el cliente acepta o firma)─► aceptada
--           borrador | propuesta ─► descartada
--
--   · La revisión 1 la edita R3ZON hasta que el cliente confirma sus datos
--     (aceptación de las condiciones). Desde ahí es INMUTABLE: totales,
--     líneas e hitos quedan congelados; nunca se recalculan con tarifas o
--     impuestos posteriores.
--   · Un cambio es una revisión nueva (copia de la vigente) que R3ZON edita y
--     PROPONE. La acepta el cliente: en el portal si no hay contrato firmado;
--     firmando el contrato nuevo si lo hay (módulo contratos). Al aceptarla,
--     la anterior pasa a sustituida. Solo un cambio abierto a la vez.
--   · Aceptar solo pasa dentro de las funciones del cliente (marca
--     `excelsior.aceptando`): R3ZON no puede aceptar por él.
--
-- Máquina de estados de la contratación (docs/ARCHITECTURE.md §20):
--
--   borrador ─► invitada ─► datos_completos ─┬─► firmada ─► activa ─► finalizada
--      │           │              │          └──────────────►┘  │
--      └───────────┴──────────────┴─► cancelada     firmada | activa ─► rescindida
--
-- `datos_completos → activa` solo sin firma en el portal; `→ firmada` solo con
-- ella. Invitar y dar los datos exigen condiciones válidas (alguna línea e
-- hitos que cuadren). Interruptores que fija R3ZON: `requires_signature` y
-- `requires_payment` (T-27).
--
-- Depende de: base (dinero), plataforma, organizaciones, invitaciones,
-- servicios.
-- =============================================================================

create type public.engagement_status as enum (
  'borrador', 'invitada', 'datos_completos', 'firmada', 'activa', 'finalizada', 'cancelada', 'rescindida'
);
create type public.revision_status as enum ('borrador', 'propuesta', 'aceptada', 'sustituida', 'descartada');

comment on type public.engagement_status is
  'Estado de una contratación. Transiciones en engagement_transition_allowed(). docs/ARCHITECTURE.md §20.';
comment on type public.revision_status is
  'Estado de una revisión de condiciones económicas. Aceptada = inmutable.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.engagements (
  id                  uuid primary key default public.uuidv7(),
  organization_id     uuid not null references public.organizations (id) on delete restrict,
  invitation_id       uuid references public.invitations (id) on delete set null,
  status              public.engagement_status not null default 'borrador',
  requires_signature  boolean not null default true,
  requires_payment    boolean not null default true,
  -- La pone la base (revisión 1 al crear; la aceptada después). FK abajo.
  current_revision_id uuid,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  status_changed_at   timestamptz not null default now()
);

comment on table public.engagements is
  'Contratación: estado CONTRACTUAL e interruptores de firma y pago en el portal. Sus condiciones económicas van en engagement_revisions. 6 años.';

create index engagements_organization_id_idx on public.engagements (organization_id, created_at desc);
create index engagements_invitation_id_idx on public.engagements (invitation_id);
create index engagements_created_by_idx on public.engagements (created_by);
create index engagements_status_idx on public.engagements (status);

create table public.engagement_revisions (
  id               uuid primary key default public.uuidv7(),
  engagement_id    uuid not null references public.engagements (id) on delete restrict,
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  number           integer not null,
  status           public.revision_status not null default 'borrador',
  -- Condiciones de pago acordadas y particulares (plazos, entregas…). Van al contrato.
  conditions       text check (conditions is null or char_length(conditions) <= 4000),
  -- Por qué cambia (revisiones a partir de la 2).
  reason           text check (reason is null or char_length(reason) <= 500),
  -- Calculado por la base (engagement_revision_recalculate). Céntimos.
  subtotal_cents   bigint not null default 0,
  discount_cents   bigint not null default 0,
  base_cents       bigint not null default 0,
  vat_cents        bigint not null default 0,
  total_cents      bigint not null default 0,
  taxes            jsonb not null default '[]'::jsonb,
  milestones_valid boolean not null default true,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  proposed_at      timestamptz,
  accepted_at      timestamptz,
  accepted_by      uuid,
  closed_at        timestamptz,

  constraint engagement_revisions_number unique (engagement_id, number),
  constraint engagement_revisions_amounts check (
    subtotal_cents >= 0 and discount_cents >= 0 and base_cents >= 0 and vat_cents >= 0 and total_cents >= 0
    and base_cents = subtotal_cents - discount_cents and total_cents = base_cents + vat_cents
  )
);

comment on table public.engagement_revisions is
  'Condiciones económicas de una contratación (revisión). Totales calculados por la base. Aceptada = inmutable. 6 años.';

create index engagement_revisions_organization_id_idx on public.engagement_revisions (organization_id);
create index engagement_revisions_created_by_idx on public.engagement_revisions (created_by);
-- Solo una revisión abierta (en edición o propuesta) por contratación.
create unique index engagement_revisions_one_open on public.engagement_revisions (engagement_id)
  where status in ('borrador', 'propuesta');

alter table public.engagements
  add constraint engagements_current_revision_fk
  foreign key (current_revision_id) references public.engagement_revisions (id) on delete restrict;
create index engagements_current_revision_id_idx on public.engagements (current_revision_id);

create table public.engagement_lines (
  id                    uuid primary key default public.uuidv7(),
  revision_id           uuid not null references public.engagement_revisions (id) on delete restrict,
  organization_id       uuid not null references public.organizations (id) on delete restrict,
  position              integer not null,
  category_id           uuid not null references public.service_categories (id) on delete restrict,
  -- De qué servicio del catálogo salió (si salió de alguno). Solo referencia.
  service_version_id    uuid references public.service_versions (id) on delete restrict,
  name                  text not null check (char_length(btrim(name)) between 1 and 200),
  description           text check (description is null or char_length(description) <= 4000),
  unit_price_cents      bigint not null check (unit_price_cents >= 0 and unit_price_cents <= 100000000000),
  discount_percent      numeric(5, 2) check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  discount_amount_cents bigint check (discount_amount_cents is null or discount_amount_cents > 0),
  vat_rate              numeric(5, 2) not null check (vat_rate >= 0 and vat_rate <= 100),
  -- Calculado por la base.
  discount_cents        bigint not null default 0,
  base_cents            bigint not null default 0,
  created_at            timestamptz not null default now(),

  constraint engagement_lines_position unique (revision_id, position),
  constraint engagement_lines_one_discount check (num_nonnulls(discount_percent, discount_amount_cents) <= 1),
  constraint engagement_lines_amounts check (
    discount_cents >= 0 and discount_cents <= unit_price_cents and base_cents = unit_price_cents - discount_cents
  )
);

comment on table public.engagement_lines is
  'Servicio de una revisión: categoría, nombre, descripción, precio sin IVA, descuento (% o importe) e IVA. Base calculada por la base.';

create index engagement_lines_organization_id_idx on public.engagement_lines (organization_id);
create index engagement_lines_category_id_idx on public.engagement_lines (category_id);
create index engagement_lines_service_version_id_idx on public.engagement_lines (service_version_id);

create table public.engagement_milestones (
  id              uuid primary key default public.uuidv7(),
  revision_id     uuid not null references public.engagement_revisions (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  position        integer not null,
  label           text not null check (char_length(btrim(label)) between 1 and 120),
  fixed_cents     bigint check (fixed_cents is null or (fixed_cents > 0 and fixed_cents <= 100000000000)),
  weight          integer check (weight is null or weight between 1 and 10000),
  -- Calculado por la base.
  amount_cents    bigint not null default 0 check (amount_cents >= 0),
  created_at      timestamptz not null default now(),

  constraint engagement_milestones_position unique (revision_id, position),
  constraint engagement_milestones_kind check (num_nonnulls(fixed_cents, weight) = 1)
);

comment on table public.engagement_milestones is
  'Hito de pago de una revisión: importe fijo o peso del reparto. Importe calculado por la base; suman el total.';

create index engagement_milestones_organization_id_idx on public.engagement_milestones (organization_id);

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
-- 2. Cálculo de las condiciones (lo único que convierte líneas en importes)
-- ─────────────────────────────────────────────────────────────────────────────
-- Recalcula totales, desglose de IVA e importes de los hitos de una revisión.
-- Definer: escribe columnas calculadas que nadie más puede escribir. Solo la
-- llaman los triggers de líneas e hitos (sin EXECUTE para nadie).
create function public.engagement_revision_recalculate(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal bigint;
  v_discount bigint;
  v_base bigint;
  v_vat bigint;
  v_taxes jsonb;
  v_total bigint;
  v_fixed bigint;
  v_n integer;
  v_weighted integer;
  v_resto bigint;
  v_valid boolean := true;
  v_parts bigint[];
begin
  select coalesce(sum(l.unit_price_cents), 0), coalesce(sum(l.discount_cents), 0), coalesce(sum(l.base_cents), 0)
    into v_subtotal, v_discount, v_base
    from public.engagement_lines l where l.revision_id = p_revision_id;

  -- IVA: una vez por tipo, sobre la suma de las bases de ese tipo.
  select coalesce(jsonb_agg(jsonb_build_object('rate', t.rate, 'base_cents', t.base, 'vat_cents', t.vat)
                            order by t.rate desc), '[]'::jsonb),
         coalesce(sum(t.vat), 0)
    into v_taxes, v_vat
    from (select l.vat_rate as rate, sum(l.base_cents) as base,
                 public.money_percent(sum(l.base_cents)::bigint, l.vat_rate) as vat
            from public.engagement_lines l where l.revision_id = p_revision_id
           group by l.vat_rate) t;
  v_total := v_base + v_vat;

  -- Hitos: primero los fijos; lo que queda, por pesos.
  select coalesce(sum(m.fixed_cents), 0), count(*), count(*) filter (where m.weight is not null)
    into v_fixed, v_n, v_weighted
    from public.engagement_milestones m where m.revision_id = p_revision_id;
  if v_n > 0 then
    v_resto := v_total - v_fixed;
    if v_resto < 0 or (v_weighted = 0 and v_resto <> 0) then
      v_valid := false;
    end if;
    if v_weighted > 0 then
      v_parts := public.money_split(greatest(v_resto, 0),
        array(select m.weight from public.engagement_milestones m
               where m.revision_id = p_revision_id and m.weight is not null order by m.position));
      update public.engagement_milestones m
         set amount_cents = v_parts[w.k]
        from (select m2.id, (row_number() over (order by m2.position))::integer as k
                from public.engagement_milestones m2
               where m2.revision_id = p_revision_id and m2.weight is not null) w
       where m.id = w.id and m.amount_cents is distinct from v_parts[w.k];
    end if;
    update public.engagement_milestones m set amount_cents = m.fixed_cents
     where m.revision_id = p_revision_id and m.fixed_cents is not null and m.amount_cents <> m.fixed_cents;
  end if;

  update public.engagement_revisions r
     set subtotal_cents = v_subtotal, discount_cents = v_discount, base_cents = v_base,
         vat_cents = v_vat, total_cents = v_total, taxes = v_taxes, milestones_valid = v_valid
   where r.id = p_revision_id;
end;
$$;
revoke execute on function public.engagement_revision_recalculate(uuid) from public, anon, authenticated;

-- ¿Se puede editar esta revisión? Solo en borrador; la vigente, solo mientras
-- el cliente no la ha aceptado; un cambio, solo con la contratación abierta.
create function public.assert_revision_editable(p_revision_id uuid)
returns public.engagement_revisions
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rev public.engagement_revisions;
  v_status public.engagement_status;
begin
  select * into v_rev from public.engagement_revisions r where r.id = p_revision_id;
  if not found then
    raise exception 'Las condiciones no existen' using errcode = 'P0001';
  end if;
  if v_rev.status <> 'borrador' then
    raise exception 'Estas condiciones ya están propuestas o aceptadas: no se cambian (crea una revisión)'
      using errcode = 'P0001';
  end if;
  select e.status into v_status from public.engagements e where e.id = v_rev.engagement_id;
  if v_status in ('finalizada', 'cancelada', 'rescindida') then
    raise exception 'La contratación está cerrada' using errcode = 'P0001';
  end if;
  return v_rev;
end;
$$;
revoke execute on function public.assert_revision_editable(uuid) from public, anon;
grant execute on function public.assert_revision_editable(uuid) to authenticated;

create function public.engagement_lines_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rev public.engagement_revisions;
begin
  if tg_op = 'UPDATE' and new.revision_id is distinct from old.revision_id then
    raise exception 'Una línea no cambia de revisión' using errcode = 'P0001';
  end if;
  v_rev := public.assert_revision_editable(case when tg_op = 'DELETE' then old.revision_id else new.revision_id end);
  if tg_op = 'DELETE' then
    return old;
  end if;

  new.organization_id := v_rev.organization_id;
  if tg_op = 'INSERT' then
    select coalesce(max(l.position), 0) + 1 into new.position
      from public.engagement_lines l where l.revision_id = new.revision_id;
  else
    new.position := old.position;
  end if;
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  if new.unit_price_cents < 0 then
    raise exception 'Un precio no puede ser negativo' using errcode = 'P0001';
  end if;
  if new.discount_percent is not null and new.discount_amount_cents is not null then
    raise exception 'Un descuento es en porcentaje o en importe, no los dos' using errcode = 'P0001';
  end if;
  new.discount_cents := coalesce(new.discount_amount_cents,
                                 public.money_percent(new.unit_price_cents, new.discount_percent), 0);
  if new.discount_cents > new.unit_price_cents then
    raise exception 'El descuento no puede superar el precio' using errcode = 'P0001';
  end if;
  new.base_cents := new.unit_price_cents - new.discount_cents;
  return new;
end;
$$;
revoke execute on function public.engagement_lines_before_write() from public, anon, authenticated;

create trigger engagement_lines_before_write
  before insert or update or delete on public.engagement_lines
  for each row execute function public.engagement_lines_before_write();

create function public.engagement_milestones_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rev public.engagement_revisions;
begin
  if tg_op = 'UPDATE' and new.revision_id is distinct from old.revision_id then
    raise exception 'Un hito no cambia de revisión' using errcode = 'P0001';
  end if;
  v_rev := public.assert_revision_editable(case when tg_op = 'DELETE' then old.revision_id else new.revision_id end);
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.organization_id := v_rev.organization_id;
  if tg_op = 'INSERT' then
    select coalesce(max(m.position), 0) + 1 into new.position
      from public.engagement_milestones m where m.revision_id = new.revision_id;
  else
    new.position := old.position;
  end if;
  new.label := btrim(new.label);
  return new;
end;
$$;
revoke execute on function public.engagement_milestones_before_write() from public, anon, authenticated;

create trigger engagement_milestones_before_write
  before insert or update or delete on public.engagement_milestones
  for each row execute function public.engagement_milestones_before_write();

-- Tras cada cambio de líneas o hitos (no de los importes calculados, que los
-- escribe el propio recálculo): recalcular y dejar rastro.
create function public.engagement_conditions_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rev uuid := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  v_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  perform public.engagement_revision_recalculate(v_rev);
  perform public.write_audit('revision.edited', v_org,
    jsonb_build_object('revision_id', v_rev, 'part', tg_table_name, 'op', lower(tg_op)));
  return null;
end;
$$;
revoke execute on function public.engagement_conditions_after_write() from public, anon, authenticated;

create trigger engagement_lines_after_write
  after insert or delete or update of category_id, service_version_id, name, description, unit_price_cents,
    discount_percent, discount_amount_cents, vat_rate
  on public.engagement_lines
  for each row execute function public.engagement_conditions_after_write();

create trigger engagement_milestones_after_write
  after insert or delete or update of label, fixed_cents, weight
  on public.engagement_milestones
  for each row execute function public.engagement_conditions_after_write();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Revisiones
-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Lista para invitar, aceptar o proponer? Alguna línea e hitos que cuadren.
create function public.revision_ready(p_revision_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.engagement_lines l where l.revision_id = p_revision_id)
     and coalesce((select r.milestones_valid from public.engagement_revisions r where r.id = p_revision_id), false);
$$;
revoke execute on function public.revision_ready(uuid) from public, anon;
grant execute on function public.revision_ready(uuid) to authenticated;

create function public.engagement_revisions_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_engagement public.engagements;
  v_current public.engagement_revisions;
begin
  if tg_op = 'INSERT' then
    select * into v_engagement from public.engagements e where e.id = new.engagement_id for update;
    if not found then
      raise exception 'La contratación no existe' using errcode = 'P0001';
    end if;
    if new.status <> 'borrador' then
      raise exception 'Una revisión nace en borrador' using errcode = 'P0001';
    end if;
    new.organization_id := v_engagement.organization_id;
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.proposed_at := null;
    new.accepted_at := null;
    new.accepted_by := null;
    new.closed_at := null;
    select coalesce(max(r.number), 0) + 1 into new.number
      from public.engagement_revisions r where r.engagement_id = new.engagement_id;
    if v_engagement.current_revision_id is not null then
      -- Un cambio: solo sobre condiciones ya aceptadas y con la contratación abierta.
      select * into v_current from public.engagement_revisions r where r.id = v_engagement.current_revision_id;
      if v_current.status <> 'aceptada' then
        raise exception 'El cliente aún no ha aceptado las condiciones: edítalas directamente' using errcode = 'P0001';
      end if;
      if v_engagement.status in ('finalizada', 'cancelada', 'rescindida') then
        raise exception 'La contratación está cerrada' using errcode = 'P0001';
      end if;
      new.conditions := coalesce(new.conditions, v_current.conditions);
      if coalesce(btrim(new.reason), '') = '' then
        raise exception 'Escribe por qué cambian las condiciones' using errcode = 'P0001';
      end if;
    end if;
    new.conditions := nullif(btrim(new.conditions), '');
    new.reason := nullif(btrim(new.reason), '');
    return new;
  end if;

  if (new.engagement_id, new.organization_id, new.number, new.created_at, new.created_by)
     is distinct from (old.engagement_id, old.organization_id, old.number, old.created_at, old.created_by) then
    raise exception 'Estos campos de una revisión no se cambian' using errcode = 'P0001';
  end if;
  if old.status <> 'borrador' and (
       (new.conditions, new.reason) is distinct from (old.conditions, old.reason)
       or (new.subtotal_cents, new.discount_cents, new.base_cents, new.vat_cents, new.total_cents, new.taxes,
           new.milestones_valid)
          is distinct from (old.subtotal_cents, old.discount_cents, old.base_cents, old.vat_cents, old.total_cents,
                            old.taxes, old.milestones_valid)) then
    raise exception 'Estas condiciones ya están propuestas o aceptadas: no se cambian' using errcode = 'P0001';
  end if;
  new.conditions := nullif(btrim(new.conditions), '');
  new.reason := nullif(btrim(new.reason), '');

  if new.status is distinct from old.status then
    if old.status = 'borrador' and new.status = 'propuesta' then
      if old.number = 1 then
        raise exception 'Las primeras condiciones no se proponen: las acepta el cliente al dar sus datos'
          using errcode = 'P0001';
      end if;
      if not public.revision_ready(new.id) then
        raise exception 'Faltan servicios o los hitos no suman el total' using errcode = 'P0001';
      end if;
      new.proposed_at := now();
    elsif old.status = 'propuesta' and new.status = 'borrador' then
      new.proposed_at := null;
    elsif old.status in ('borrador', 'propuesta') and new.status = 'descartada' then
      if old.number = 1 then
        raise exception 'Las primeras condiciones no se descartan: cancela la contratación' using errcode = 'P0001';
      end if;
      new.closed_at := now();
    elsif new.status = 'aceptada' and (
            (old.status = 'borrador' and old.number = 1) or old.status = 'propuesta') then
      if current_setting('excelsior.aceptando', true) is distinct from 'on' then
        raise exception 'Las condiciones las acepta el cliente' using errcode = '42501';
      end if;
      if not public.revision_ready(new.id) then
        raise exception 'Faltan las condiciones económicas: servicios y hitos que sumen el total'
          using errcode = 'P0001';
      end if;
      new.accepted_at := now();
      new.accepted_by := (select auth.uid());
    elsif old.status = 'aceptada' and new.status = 'sustituida' then
      if current_setting('excelsior.sustituyendo', true) is distinct from 'on' then
        raise exception 'Una revisión aceptada solo se sustituye aceptando otra' using errcode = 'P0001';
      end if;
      new.closed_at := now();
    else
      raise exception 'Cambio no permitido: % → %', old.status, new.status using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.engagement_revisions_before_write() from public, anon, authenticated;

create trigger engagement_revisions_before_write
  before insert or update on public.engagement_revisions
  for each row execute function public.engagement_revisions_before_write();

create function public.engagement_revisions_no_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Una revisión no se borra: se descarta' using errcode = 'P0001';
end;
$$;
revoke execute on function public.engagement_revisions_no_delete() from public, anon, authenticated;

create trigger engagement_revisions_no_delete
  before delete on public.engagement_revisions
  for each row execute function public.engagement_revisions_no_delete();

-- Al crear un cambio, copia las líneas y los hitos de la vigente. Al aceptar
-- un cambio, la anterior queda sustituida y la nueva pasa a ser la vigente.
-- Definer: toca la contratación y la revisión anterior, que nadie escribe a mano.
create function public.engagement_revisions_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
begin
  if tg_op = 'INSERT' then
    select e.current_revision_id into v_current from public.engagements e where e.id = new.engagement_id;
    if v_current is not null then
      insert into public.engagement_lines
        (revision_id, category_id, service_version_id, name, description, unit_price_cents,
         discount_percent, discount_amount_cents, vat_rate)
      select new.id, l.category_id, l.service_version_id, l.name, l.description, l.unit_price_cents,
             l.discount_percent, l.discount_amount_cents, l.vat_rate
        from public.engagement_lines l where l.revision_id = v_current order by l.position;
      insert into public.engagement_milestones (revision_id, label, fixed_cents, weight)
      select new.id, m.label, m.fixed_cents, m.weight
        from public.engagement_milestones m where m.revision_id = v_current order by m.position;
    end if;
    perform public.write_audit('revision.created', new.organization_id,
      jsonb_build_object('engagement_id', new.engagement_id, 'revision_id', new.id, 'number', new.number));
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aceptada' and old.status = 'propuesta' then
      select e.current_revision_id into v_current from public.engagements e where e.id = new.engagement_id for update;
      perform set_config('excelsior.sustituyendo', 'on', true);
      update public.engagement_revisions set status = 'sustituida' where id = v_current;
      perform set_config('excelsior.sustituyendo', 'off', true);
      update public.engagements set current_revision_id = new.id where id = new.engagement_id;
    end if;
    perform public.write_audit('revision.' || new.status::text, new.organization_id,
      jsonb_build_object('engagement_id', new.engagement_id, 'revision_id', new.id, 'number', new.number,
                         'from', old.status, 'total_cents', new.total_cents));
  end if;
  return null;
end;
$$;
revoke execute on function public.engagement_revisions_after_write() from public, anon, authenticated;

create trigger engagement_revisions_after_write
  after insert or update on public.engagement_revisions
  for each row execute function public.engagement_revisions_after_write();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Máquina de estados de la contratación
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
    ('datos_completos', 'firmada'), ('datos_completos', 'activa'), ('datos_completos', 'cancelada'),
    ('firmada', 'activa'), ('firmada', 'rescindida'),
    ('activa', 'finalizada'), ('activa', 'rescindida')
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
    new.current_revision_id := null; -- la revisión 1 la crea el trigger de después
    new.status_changed_at := now();
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.created_at is distinct from old.created_at
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'Estos campos de una contratación no se cambian' using errcode = 'P0001';
  end if;

  -- La revisión vigente: la primera al crear; después, solo una aceptada suya.
  if new.current_revision_id is distinct from old.current_revision_id then
    if new.current_revision_id is null or not exists (
         select 1 from public.engagement_revisions r
          where r.id = new.current_revision_id and r.engagement_id = new.id
            and (old.current_revision_id is null or r.status = 'aceptada')) then
      raise exception 'La revisión vigente solo cambia al aceptar otra' using errcode = 'P0001';
    end if;
  end if;

  if new.invitation_id is distinct from old.invitation_id
     and new.invitation_id is not null and old.status not in ('borrador', 'invitada') then
    raise exception 'La invitación solo se enlaza al principio' using errcode = 'P0001';
  end if;

  -- Firma en el portal: se decide antes de que haya nada firmado.
  if new.requires_signature is distinct from old.requires_signature
     and old.status not in ('borrador', 'invitada', 'datos_completos') then
    raise exception 'Ya no se puede cambiar si se firma en el portal' using errcode = 'P0001';
  end if;
  -- Pago en el portal: mientras la contratación siga viva.
  if new.requires_payment is distinct from old.requires_payment
     and old.status in ('finalizada', 'cancelada', 'rescindida') then
    raise exception 'La contratación está cerrada' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not public.engagement_transition_allowed(old.status, new.status) then
      raise exception 'Transición no permitida: % → %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status in ('invitada', 'datos_completos') and not public.revision_ready(new.current_revision_id) then
      raise exception 'Faltan las condiciones económicas: añade algún servicio y hitos que sumen el total'
        using errcode = 'P0001';
    end if;
    if old.status = 'datos_completos' and new.status = 'activa' and new.requires_signature then
      raise exception 'Falta la firma del contrato (o desmarca «firma en el portal» si ya se firmó fuera)'
        using errcode = 'P0001';
    end if;
    if new.status = 'firmada' and not new.requires_signature then
      raise exception 'Esta contratación no se firma en el portal' using errcode = 'P0001';
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

-- Revisión 1 al crear; aceptación de las condiciones al dar los datos;
-- historial y registro. Definer: el historial no tiene grants de escritura y
-- la revisión vigente no la escribe nadie a mano.
create function public.engagements_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rev uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.engagement_revisions (engagement_id) values (new.id) returning id into v_rev;
    update public.engagements set current_revision_id = v_rev where id = new.id;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'datos_completos' then
    -- Dar los datos = aceptar las condiciones económicas que se le mostraron.
    perform set_config('excelsior.aceptando', 'on', true);
    update public.engagement_revisions set status = 'aceptada'
     where id = new.current_revision_id and status = 'borrador';
    perform set_config('excelsior.aceptando', 'off', true);
  end if;

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
-- 5. Funciones de la app
-- ─────────────────────────────────────────────────────────────────────────────
-- Línea a partir de un servicio del catálogo: copia nombre, resumen, precio
-- (o el pactado) e IVA. Invoker: solo el staff (RLS).
create function public.add_catalog_line(
  p_revision_id uuid,
  p_service_version_id uuid,
  p_price_cents bigint default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_line uuid;
  v_category uuid;
begin
  select coalesce(s.category_id,
                  (select c.id from public.service_categories c
                    where lower(c.name) = 'otros servicios personalizados'))
    into v_category
    from public.service_versions v join public.services s on s.id = v.service_id
   where v.id = p_service_version_id;
  if not found then
    raise exception 'El servicio no existe' using errcode = 'P0001';
  end if;
  insert into public.engagement_lines
    (revision_id, category_id, service_version_id, name, description, unit_price_cents, vat_rate)
  select p_revision_id, v_category, v.id, s.name, s.summary, coalesce(p_price_cents, v.price_cents), v.vat_rate
    from public.service_versions v join public.services s on s.id = v.service_id
   where v.id = p_service_version_id
  returning id into v_line;
  return v_line;
end;
$$;

comment on function public.add_catalog_line(uuid, uuid, bigint) is
  'Añade a una revisión una línea copiada de un servicio del catálogo (precio pactado opcional). Solo staff (RLS).';
revoke execute on function public.add_catalog_line(uuid, uuid, bigint) from public, anon;
grant execute on function public.add_catalog_line(uuid, uuid, bigint) to authenticated;

-- Invitar a un cliente a contratar un servicio del catálogo: contratación con
-- una línea + invitación, en una transacción. SECURITY INVOKER: solo el staff
-- (RLS). Para varios servicios: crear en borrador, añadir líneas e invitar.
create function public.invite_to_service(
  p_organization_id uuid,
  p_email text,
  p_service_version_id uuid,
  p_price_cents bigint default null,
  p_conditions text default null,
  p_requires_signature boolean default true,
  p_requires_payment boolean default true
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_engagement_id uuid;
  v_revision uuid;
begin
  insert into public.engagements (organization_id, requires_signature, requires_payment)
  values (p_organization_id, coalesce(p_requires_signature, true), coalesce(p_requires_payment, true))
  returning id, current_revision_id into v_engagement_id, v_revision;
  -- current_revision_id lo pone el trigger de después: se lee otra vez.
  select e.current_revision_id into v_revision from public.engagements e where e.id = v_engagement_id;
  update public.engagement_revisions set conditions = p_conditions where id = v_revision;
  perform public.add_catalog_line(v_revision, p_service_version_id, p_price_cents);
  return public.invite_engagement(v_engagement_id, p_email);
end;
$$;

-- Invitar (o reinvitar) a una contratación ya creada: la que el equipo preparó
-- en borrador, o una invitada cuya invitación hay que reenviar. Invoker: solo
-- staff (RLS). Reenviar revoca la invitación anterior de la contratación, sea
-- al mismo email o a otro: nunca quedan dos enlaces vivos para la misma alta.
create function public.invite_engagement(p_engagement_id uuid, p_email text)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_engagement public.engagements;
  v_token text;
  v_invitation_id uuid;
begin
  select * into v_engagement from public.engagements e where e.id = p_engagement_id for update;
  if not found then
    raise exception 'La contratación no existe' using errcode = 'P0001';
  end if;
  if v_engagement.status not in ('borrador', 'invitada') then
    raise exception 'Esta contratación ya no admite invitaciones (estado %)', v_engagement.status
      using errcode = 'P0001';
  end if;

  if v_engagement.invitation_id is not null then
    update public.invitations set revoked_at = now()
     where id = v_engagement.invitation_id and accepted_at is null and revoked_at is null;
  end if;

  v_token := public.create_invitation(v_engagement.organization_id, p_email, 'owner');
  select i.id into v_invitation_id from public.invitations i
   where i.token_hash = extensions.digest(v_token, 'sha256');

  update public.engagements
     set invitation_id = v_invitation_id,
         status = 'invitada'
   where id = p_engagement_id;
  return v_token;
end;
$$;

comment on function public.invite_engagement(uuid, text) is
  'Invita (o reinvita) a una contratación en borrador o invitada, con condiciones válidas. Revoca la invitación anterior. Solo staff (RLS).';
grant execute on function public.invite_engagement(uuid, text) to authenticated;

comment on function public.invite_to_service(uuid, text, uuid, bigint, text, boolean, boolean) is
  'Crea una contratación con un servicio del catálogo y la invitación para el cliente (solo staff, por RLS). Devuelve el token una vez.';
grant execute on function public.invite_to_service(uuid, text, uuid, bigint, text, boolean, boolean) to authenticated;

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

-- El cliente acepta un cambio de condiciones propuesto por R3ZON. Si ya hay un
-- contrato firmado, el cambio se acepta firmando el contrato nuevo (no aquí).
-- Definer: el cliente no escribe revisiones; las condiciones van dentro.
create function public.accept_engagement_revision(p_revision_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rev public.engagement_revisions;
begin
  select * into v_rev from public.engagement_revisions r where r.id = p_revision_id for update;
  if not found or not public.is_org_member(v_rev.organization_id) then
    raise exception 'Las condiciones no existen' using errcode = 'P0001';
  end if;
  if public.org_role_of(v_rev.organization_id) not in ('owner', 'billing') then
    raise exception 'Solo el propietario o facturación pueden aceptar las condiciones' using errcode = '42501';
  end if;
  if v_rev.status <> 'propuesta' then
    raise exception 'No hay un cambio de condiciones pendiente de aceptar' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.contracts c where c.engagement_id = v_rev.engagement_id and c.status = 'firmado') then
    raise exception 'Este cambio se acepta firmando el contrato nuevo que te enviará R3ZON' using errcode = 'P0001';
  end if;
  perform set_config('excelsior.aceptando', 'on', true);
  update public.engagement_revisions set status = 'aceptada' where id = p_revision_id;
  perform set_config('excelsior.aceptando', 'off', true);
end;
$$;

comment on function public.accept_engagement_revision(uuid) is
  'El cliente (propietario o facturación) acepta un cambio de condiciones propuesto. Con contrato firmado, se acepta firmando.';
revoke execute on function public.accept_engagement_revision(uuid) from public, anon;
grant execute on function public.accept_engagement_revision(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.engagements, public.engagement_revisions, public.engagement_lines,
  public.engagement_milestones, public.engagement_status_history from anon, authenticated;

grant select,
      insert (organization_id, requires_signature, requires_payment),
      update (status, invitation_id, requires_signature, requires_payment)
  on table public.engagements to authenticated;
grant select, insert (engagement_id, conditions, reason), update (status, conditions, reason)
  on table public.engagement_revisions to authenticated;
grant select,
      insert (revision_id, category_id, service_version_id, name, description, unit_price_cents,
              discount_percent, discount_amount_cents, vat_rate),
      update (category_id, service_version_id, name, description, unit_price_cents,
              discount_percent, discount_amount_cents, vat_rate),
      delete
  on table public.engagement_lines to authenticated;
grant select, insert (revision_id, label, fixed_cents, weight), update (label, fixed_cents, weight), delete
  on table public.engagement_milestones to authenticated;
grant select on table public.engagement_status_history to authenticated;

alter table public.engagements enable row level security;
alter table public.engagement_revisions enable row level security;
alter table public.engagement_lines enable row level security;
alter table public.engagement_milestones enable row level security;
alter table public.engagement_status_history enable row level security;

-- El cliente ve las contrataciones de sus empresas; el staff, todas.
create policy engagements_select
  on public.engagements for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

-- Crear y cambiar: el equipo. Los pasos del cliente van por funciones propias.
create policy engagements_insert_staff
  on public.engagements for insert
  to authenticated
  with check ((select public.is_staff()));

create policy engagements_update_staff
  on public.engagements for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Revisiones: el cliente ve la vigente, las propuestas y las de su historial;
-- no ve los cambios que R3ZON está preparando ni los descartados.
create policy engagement_revisions_select
  on public.engagement_revisions for select
  to authenticated
  using (
    (select public.is_staff())
    or (public.is_org_member(organization_id) and (
          status in ('propuesta', 'aceptada', 'sustituida')
          or exists (select 1 from public.engagements e
                      where e.id = engagement_revisions.engagement_id and e.current_revision_id = engagement_revisions.id)))
  );

create policy engagement_revisions_insert_staff
  on public.engagement_revisions for insert
  to authenticated
  with check ((select public.is_staff()));

create policy engagement_revisions_update_staff
  on public.engagement_revisions for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Líneas e hitos: los de las revisiones que cada uno puede ver; los escribe el equipo.
create policy engagement_lines_select
  on public.engagement_lines for select
  to authenticated
  using (
    (select public.is_staff())
    or (public.is_org_member(organization_id)
        and exists (select 1 from public.engagement_revisions r where r.id = engagement_lines.revision_id))
  );

create policy engagement_lines_write_staff
  on public.engagement_lines for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy engagement_milestones_select
  on public.engagement_milestones for select
  to authenticated
  using (
    (select public.is_staff())
    or (public.is_org_member(organization_id)
        and exists (select 1 from public.engagement_revisions r where r.id = engagement_milestones.revision_id))
  );

create policy engagement_milestones_write_staff
  on public.engagement_milestones for all
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Alta de cliente e invitación de una vez (Fase 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- La otra vía (crear el cliente y después invitar desde su ficha) sigue
-- existiendo. Invoker: solo el staff puede (RLS). Todo o nada.
create function public.create_client_with_invitation(
  p_name text,
  p_email text,
  p_service_version_id uuid default null,
  p_price_cents bigint default null,
  p_conditions text default null,
  p_requires_signature boolean default true,
  p_requires_payment boolean default true
)
returns table (organization_id uuid, token text)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
begin
  insert into public.organizations (name) values (btrim(p_name)) returning id into v_org;
  organization_id := v_org;
  if p_service_version_id is null then
    token := public.create_invitation(v_org, p_email, 'owner');
  else
    token := public.invite_to_service(v_org, p_email, p_service_version_id, p_price_cents, p_conditions,
                                      p_requires_signature, p_requires_payment);
  end if;
  return next;
end;
$$;

comment on function public.create_client_with_invitation(text, text, uuid, bigint, text, boolean, boolean) is
  'Crea el cliente y la invitación (con o sin servicio) en una transacción. Solo staff, por RLS.';
grant execute on function public.create_client_with_invitation(text, text, uuid, bigint, text, boolean, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Pasos del cliente (Fase 3)
-- ─────────────────────────────────────────────────────────────────────────────
-- ¿Tiene la empresa todo lo que el contrato y la factura necesitan?
create function public.billing_complete(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.organization_billing b where b.organization_id = p_organization_id);
$$;
revoke execute on function public.billing_complete(uuid) from public, anon;
grant execute on function public.billing_complete(uuid) to authenticated;

-- El cliente confirma sus datos (invitada → datos_completos), y con ello
-- ACEPTA las condiciones económicas vigentes (trigger). Definer porque la RLS
-- de engagements solo deja escribir al staff; las condiciones (miembro con
-- permiso, estado, datos completos) van dentro y la transición la vuelve a
-- comprobar el trigger.
create function public.confirm_engagement_data(p_engagement_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status public.engagement_status;
begin
  select e.organization_id, e.status into v_org, v_status
    from public.engagements e where e.id = p_engagement_id for update;
  if not found or not public.is_org_member(v_org) then
    raise exception 'La contratación no existe' using errcode = 'P0001';
  end if;
  if public.org_role_of(v_org) not in ('owner', 'billing') then
    raise exception 'Solo el propietario o facturación pueden confirmar los datos' using errcode = '42501';
  end if;
  if v_status = 'datos_completos' then
    return; -- idempotente: volver atrás en el asistente y confirmar otra vez no falla
  end if;
  if v_status <> 'invitada' then
    raise exception 'Los datos ya no se pueden confirmar en este paso' using errcode = 'P0001';
  end if;
  if not public.billing_complete(v_org) then
    raise exception 'Faltan los datos fiscales de la empresa' using errcode = 'P0001';
  end if;
  update public.engagements set status = 'datos_completos' where id = p_engagement_id;
end;
$$;

comment on function public.confirm_engagement_data(uuid) is
  'El cliente confirma sus datos y acepta las condiciones (invitada → datos_completos). Comprobaciones dentro.';
revoke execute on function public.confirm_engagement_data(uuid) from public, anon;
grant execute on function public.confirm_engagement_data(uuid) to authenticated;
