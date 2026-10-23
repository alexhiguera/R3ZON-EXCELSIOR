-- =============================================================================
-- Excelsior · módulo COBROS — estado económico de cada contratación
-- =============================================================================
--
-- Decisiones de R3ZON (2026-10-23, docs/PLAN.md T-26 a T-29):
--   · El estado ECONÓMICO va aparte del contractual: una contratación firmada
--     puede estar sin pagar y una pagada, sin firmar.
--   · R3ZON registra los cobros recibidos fuera del portal (transferencia
--     directa u otro método documentado) antes o después de invitar. Nunca
--     efectivo, y estos métodos no los elige el cliente.
--   · Los cobros por Stripe (Fase 4) entran en el MISMO libro, solo desde el
--     servidor (webhook), con su id de operación como clave única.
--   · El portal no factura: lo hace Antares con TicketBAI. Aquí solo se guarda
--     si un cobro ya está facturado y con qué referencia, para no duplicar.
--
-- Libro de cobros (`payments`): nada se edita ni se borra. Una corrección es
-- ANULAR con motivo y registrar otro: el historial siempre explica el saldo.
--
-- Estado de cobro (derivado, nunca guardado):
--   pendiente_revision  si R3ZON lo marcó, si hay una operación pendiente o si
--                       lo cobrado supera el total;
--   pagado              si lo cobrado cubre el total (con IVA);
--   parcialmente_pagado si hay algo cobrado;
--   no_pagado           si no.
--
-- Depende de: plataforma, organizaciones, servicios, contrataciones.
-- =============================================================================

create type public.payment_method as enum ('transferencia', 'otro', 'stripe');
create type public.payment_status as enum ('pendiente', 'confirmado', 'fallido', 'devuelto', 'anulado');
create type public.collection_status as enum ('no_pagado', 'parcialmente_pagado', 'pagado', 'pendiente_revision');

comment on type public.payment_method is
  'Cómo se cobró. transferencia y otro: los registra el equipo (cobros externos). stripe: solo el servidor. Sin efectivo (decisión de R3ZON).';

-- «Pendiente de revisión» manual: R3ZON detecta una discrepancia y bloquea
-- nuevos cobros hasta resolverla.
alter table public.engagements
  add column payment_review boolean not null default false,
  add column payment_review_note text check (payment_review_note is null or char_length(payment_review_note) <= 500);

grant update (payment_review, payment_review_note) on table public.engagements to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Libro de cobros
-- ─────────────────────────────────────────────────────────────────────────────
create table public.payments (
  id                 uuid primary key default public.uuidv7(),
  engagement_id      uuid not null references public.engagements (id) on delete restrict,
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  amount_cents       bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency           text not null default 'EUR' check (currency = 'EUR'),
  method             public.payment_method not null,
  status             public.payment_status not null default 'confirmado',
  paid_on            date not null,
  reference          text check (reference is null or char_length(reference) <= 200),
  receipt_reference  text check (receipt_reference is null or char_length(receipt_reference) <= 300),
  provider_reference text unique check (provider_reference is null or char_length(provider_reference) <= 255),
  invoice_reference  text check (invoice_reference is null or char_length(invoice_reference) <= 100),
  invoiced_at        timestamptz,
  voided_reason      text check (voided_reason is null or char_length(voided_reason) <= 500),
  voided_at          timestamptz,
  voided_by          uuid,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint payments_stripe_reference check ((method = 'stripe') = (provider_reference is not null)),
  constraint payments_voided_consistency check (
    (status = 'anulado') = (voided_at is not null and voided_reason is not null)
  ),
  constraint payments_invoiced_consistency check ((invoice_reference is null) = (invoiced_at is null))
);

comment on table public.payments is
  'Libro de cobros: externos (equipo) y Stripe (servidor). Inmutable salvo anular, facturar y los estados de Stripe. 6 años.';
comment on column public.payments.receipt_reference is
  'Justificante: referencia o ubicación del documento (el fichero, con el almacenamiento de la Fase 5).';
comment on column public.payments.invoice_reference is
  'Referencia de la factura en Antares (TicketBAI). Si existe, este cobro ya está facturado: no se vuelve a facturar.';

create index payments_engagement_idx on public.payments (engagement_id, created_at);
create index payments_organization_idx on public.payments (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Importes y estado
-- ─────────────────────────────────────────────────────────────────────────────
-- Vista con el estado económico de cada contratación. security_invoker: cada
-- uno ve las suyas (cliente) o todas (staff), por la RLS de las tablas.
create view public.engagement_collections
with (security_invoker = true) as
  select
    e.id as engagement_id,
    e.organization_id,
    e.requires_payment,
    e.payment_review,
    t.total_cents,
    coalesce(p.paid_cents, 0) as paid_cents,
    coalesce(p.pending_cents, 0) as pending_cents,
    greatest(t.total_cents - coalesce(p.paid_cents, 0), 0) as balance_cents,
    case
      when e.payment_review or coalesce(p.pending_cents, 0) > 0 or coalesce(p.paid_cents, 0) > t.total_cents
        then 'pendiente_revision'
      when coalesce(p.paid_cents, 0) >= t.total_cents then 'pagado'
      when coalesce(p.paid_cents, 0) > 0 then 'parcialmente_pagado'
      else 'no_pagado'
    end::public.collection_status as status
  from public.engagements e
  join public.service_versions sv on sv.id = e.service_version_id
  cross join lateral (
    select e.price_cents + round(e.price_cents * sv.vat_rate / 100)::bigint as total_cents
  ) t
  left join lateral (
    select sum(amount_cents) filter (where status = 'confirmado') as paid_cents,
           sum(amount_cents) filter (where status = 'pendiente') as pending_cents
      from public.payments pa where pa.engagement_id = e.id
  ) p on true;

comment on view public.engagement_collections is
  'Estado económico de cada contratación: total con IVA, cobrado, en curso, saldo y estado. Derivado del libro de cobros.';

-- Importe que se le puede pedir AHORA al cliente en el portal. Cero si la
-- contratación no se paga en el portal, si está en revisión o si ya está
-- pagada. Lo calcula la base: el navegador nunca dice cuánto se cobra. Los
-- hitos (señal + entrega) se añaden con la Fase 4.
create function public.amount_due_now(p_engagement_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select case
           when c.requires_payment and c.status in ('no_pagado', 'parcialmente_pagado') then c.balance_cents
           else 0
         end
    from public.engagement_collections c
   where c.engagement_id = p_engagement_id;
$$;

comment on function public.amount_due_now(uuid) is
  'Importe exigible ahora en el portal (0 si no se paga en el portal, si está en revisión o pagado).';
revoke execute on function public.amount_due_now(uuid) from public, anon;
grant execute on function public.amount_due_now(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Reglas (triggers)
-- ─────────────────────────────────────────────────────────────────────────────
create function public.payments_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_engagement public.engagements;
  v_total bigint;
  v_comprometido bigint;
begin
  -- Bloquea la contratación: dos cobros a la vez no pueden pasar los dos el
  -- control de «no superar el total».
  select * into v_engagement from public.engagements e where e.id = new.engagement_id for update;
  if not found then
    raise exception 'La contratación no existe' using errcode = 'P0001';
  end if;
  if v_engagement.status = 'cancelada' then
    raise exception 'La contratación está cancelada' using errcode = 'P0001';
  end if;

  new.organization_id := v_engagement.organization_id;
  new.created_by := (select auth.uid());
  new.invoice_reference := null;
  new.invoiced_at := null;
  new.voided_reason := null;
  new.voided_at := null;
  new.voided_by := null;

  -- Stripe solo desde el servidor (webhook con service_role). El equipo
  -- registra cobros externos, ya confirmados.
  if new.method = 'stripe' then
    if current_user not in ('service_role', 'postgres') then
      raise exception 'Los cobros de Stripe solo los registra el servidor' using errcode = '42501';
    end if;
  elsif new.status <> 'confirmado' then
    raise exception 'Un cobro externo se registra como confirmado' using errcode = 'P0001';
  end if;

  if new.paid_on > (now() at time zone 'Europe/Madrid')::date then
    raise exception 'La fecha de cobro no puede ser futura' using errcode = 'P0001';
  end if;

  -- Nunca cobrar más de lo exigible: ni un cobro externo duplicado ni una
  -- operación de Stripe sobre algo ya pagado.
  if new.status in ('confirmado', 'pendiente') then
    select total_cents into v_total from public.engagement_collections where engagement_id = new.engagement_id;
    select coalesce(sum(amount_cents), 0) into v_comprometido
      from public.payments
     where engagement_id = new.engagement_id and status in ('confirmado', 'pendiente');
    if v_comprometido + new.amount_cents > v_total then
      raise exception 'Este cobro superaría el total de la contratación (% de % ya cobrado o en curso)',
        public.format_eur(v_comprometido), public.format_eur(v_total)
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.payments_before_insert() from public, anon, authenticated;

create trigger payments_before_insert
  before insert on public.payments
  for each row execute function public.payments_before_insert();

-- Lo único que cambia de un cobro: anularlo (con motivo), facturarlo (una vez)
-- y, solo el servidor, el estado de una operación de Stripe.
create function public.payments_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_servidor boolean := current_user in ('service_role', 'postgres');
begin
  if (new.engagement_id, new.organization_id, new.amount_cents, new.currency, new.method, new.paid_on,
      new.reference, new.receipt_reference, new.provider_reference, new.created_by, new.created_at)
     is distinct from
     (old.engagement_id, old.organization_id, old.amount_cents, old.currency, old.method, old.paid_on,
      old.reference, old.receipt_reference, old.provider_reference, old.created_by, old.created_at) then
    raise exception 'Un cobro no se modifica: se anula y se registra otro' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'anulado' then
      if old.status <> 'confirmado' or old.method = 'stripe' then
        raise exception 'Solo se anula un cobro externo confirmado (los de Stripe se devuelven en Stripe)'
          using errcode = 'P0001';
      end if;
      if old.invoice_reference is not null then
        raise exception 'Este cobro ya está facturado: corrígelo en Antares con una factura rectificativa'
          using errcode = 'P0001';
      end if;
      if char_length(btrim(coalesce(new.voided_reason, ''))) < 3 then
        raise exception 'Escribe el motivo de la anulación' using errcode = 'P0001';
      end if;
      new.voided_at := now();
      new.voided_by := (select auth.uid());
    elsif old.method = 'stripe' and v_servidor
          and (old.status, new.status) in (('pendiente', 'confirmado'), ('pendiente', 'fallido'), ('confirmado', 'devuelto')) then
      null; -- transiciones de Stripe, solo desde el servidor
    else
      raise exception 'Cambio de estado no permitido: % → %', old.status, new.status using errcode = 'P0001';
    end if;
  elsif new.voided_reason is distinct from old.voided_reason then
    raise exception 'El motivo solo se escribe al anular' using errcode = 'P0001';
  end if;

  if new.invoice_reference is distinct from old.invoice_reference then
    if old.invoice_reference is not null then
      raise exception 'La factura de un cobro no se cambia' using errcode = 'P0001';
    end if;
    if old.status <> 'confirmado' then
      raise exception 'Solo se factura un cobro confirmado' using errcode = 'P0001';
    end if;
    new.invoice_reference := btrim(new.invoice_reference);
    new.invoiced_at := now();
  elsif new.invoiced_at is distinct from old.invoiced_at then
    raise exception 'La fecha de factura la pone la base' using errcode = 'P0001';
  end if;

  if (new.voided_at, new.voided_by) is distinct from (old.voided_at, old.voided_by)
     and new.status is not distinct from old.status then
    raise exception 'Estos campos los pone la base' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.payments_before_update() from public, anon, authenticated;

create trigger payments_before_update
  before update on public.payments
  for each row execute function public.payments_before_update();

create function public.payments_no_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Un cobro no se borra: se anula' using errcode = 'P0001';
end;
$$;
revoke execute on function public.payments_no_delete() from public, anon, authenticated;

create trigger payments_no_delete
  before delete on public.payments
  for each row execute function public.payments_no_delete();

create function public.payments_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('payment.registered', new.organization_id,
      jsonb_build_object('payment_id', new.id, 'engagement_id', new.engagement_id,
                         'amount_cents', new.amount_cents, 'method', new.method, 'status', new.status));
  else
    if new.status is distinct from old.status then
      perform public.write_audit('payment.' || new.status::text, new.organization_id,
        jsonb_build_object('payment_id', new.id, 'from', old.status));
    end if;
    if new.invoice_reference is distinct from old.invoice_reference then
      perform public.write_audit('payment.invoiced', new.organization_id, jsonb_build_object('payment_id', new.id));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.payments_audit() from public, anon, authenticated;

create trigger payments_audit
  after insert or update on public.payments
  for each row execute function public.payments_audit();

-- Marcar o desmarcar «pendiente de revisión» queda registrado.
create function public.engagements_audit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    case when new.payment_review then 'collection.review_opened' else 'collection.review_closed' end,
    new.organization_id, jsonb_build_object('engagement_id', new.id));
  return null;
end;
$$;
revoke execute on function public.engagements_audit_review() from public, anon, authenticated;

create trigger engagements_audit_review
  after update of payment_review on public.engagements
  for each row when (old.payment_review is distinct from new.payment_review)
  execute function public.engagements_audit_review();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.payments, public.engagement_collections from anon, authenticated;
grant select,
      insert (engagement_id, amount_cents, currency, method, paid_on, reference, receipt_reference),
      update (status, voided_reason, invoice_reference)
  on table public.payments to authenticated;
grant select on table public.engagement_collections to authenticated;

alter table public.payments enable row level security;

-- El cliente ve los cobros de sus empresas (su historial); el staff, todos.
create policy payments_select
  on public.payments for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

-- Registrar, anular y facturar: el equipo. El cliente no toca el libro.
create policy payments_insert_staff
  on public.payments for insert
  to authenticated
  with check ((select public.is_staff()));

create policy payments_update_staff
  on public.payments for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
