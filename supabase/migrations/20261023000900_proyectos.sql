-- =============================================================================
-- Excelsior · módulo PROYECTOS — el trabajo que nace de una contratación y su
-- briefing (Fase 5, sin ficheros)
-- =============================================================================
--
-- Decisiones de R3ZON (2026-10-23, docs/PLAN.md):
--   · T-32: el proyecto nace cuando el cliente COMPLETA SU ALTA (sus datos y,
--     si la tiene, la firma; el pago nunca bloquea), sin esperar a que R3ZON
--     active la contratación.
--   · T-33: la subida de ficheros (logo, imágenes) se aplaza: va con la
--     cuarentena y el antivirus. El briefing empieza con texto, colores,
--     tipografías y enlaces.
--   · T-07: el briefing NUNCA pide contraseñas ni accesos: no hay tipo para eso.
--
-- · service_briefing_items: plantilla de briefing de cada servicio (la edita
--   admin). Se COPIA al proyecto al crearlo: cambiar la plantilla no toca los
--   proyectos que ya existen.
-- · projects: uno por contratación, con su máquina de estados.
-- · project_briefing_items: lo que el cliente aporta, elemento a elemento, y
--   lo que R3ZON le contesta (validado o «cambios», con nota).
-- · project_briefing_progress: progreso derivado (nunca guardado).
--
-- Máquina de estados del proyecto (docs/ARCHITECTURE.md §20):
--
--   briefing ─► diseño ─► desarrollo ◄─► revisión ─► lanzado ─► mantenimiento
--      └─────────────────────────────────────────────────────────►┘
--   cualquiera activo ⇄ en_pausa        cualquiera no cancelado ─► cancelado
--
-- Estados de un elemento del briefing:
--   cliente:  pendiente | más tarde | cambios ─► aportado | más tarde | no aplica (solo opcionales)
--   R3ZON:    aportado ─► validado | cambios (con nota) · y puede reabrir
--   validado: el cliente ya no lo toca.
--
-- Escriben el briefing el propietario y los miembros; facturación solo lee
-- (docs/ROLES.md). Depende de: plataforma, organizaciones, servicios,
-- contrataciones.
-- =============================================================================

create type public.project_status as enum (
  'briefing', 'diseno', 'desarrollo', 'revision', 'lanzado', 'mantenimiento', 'en_pausa', 'cancelado'
);
create type public.briefing_kind as enum ('texto', 'color', 'tipografia', 'enlace');
create type public.briefing_status as enum ('pendiente', 'mas_tarde', 'no_aplica', 'aportado', 'cambios', 'validado');

comment on type public.briefing_kind is
  'Tipo de un elemento del briefing. Sin «fichero» todavía (T-33) y nunca «acceso» ni contraseñas (T-07).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Plantilla de briefing por servicio
-- ─────────────────────────────────────────────────────────────────────────────
create table public.service_briefing_items (
  id         uuid primary key default public.uuidv7(),
  service_id uuid not null references public.services (id) on delete restrict,
  position   integer not null,
  section    text not null default 'General' check (char_length(btrim(section)) between 1 and 60),
  kind       public.briefing_kind not null,
  label      text not null check (char_length(btrim(label)) between 1 and 120),
  help       text check (help is null or char_length(help) <= 1000),
  required   boolean not null default true,
  created_at timestamptz not null default now(),

  constraint service_briefing_items_position unique (service_id, position)
);

comment on table public.service_briefing_items is
  'Plantilla de briefing de un servicio. Se copia al proyecto al crearlo. La edita admin.';

-- La posición la pone la base: al final de la lista.
create function public.service_briefing_items_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.section := btrim(new.section);
  new.label := btrim(new.label);
  new.help := nullif(btrim(new.help), '');
  select coalesce(max(i.position), 0) + 1 into new.position
    from public.service_briefing_items i where i.service_id = new.service_id;
  return new;
end;
$$;
revoke execute on function public.service_briefing_items_before_insert() from public, anon, authenticated;

create trigger service_briefing_items_before_insert
  before insert on public.service_briefing_items
  for each row execute function public.service_briefing_items_before_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Proyectos
-- ─────────────────────────────────────────────────────────────────────────────
create table public.projects (
  id                uuid primary key default public.uuidv7(),
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  engagement_id     uuid not null unique references public.engagements (id) on delete restrict,
  name              text not null check (char_length(btrim(name)) between 1 and 200),
  status            public.project_status not null default 'briefing',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);

comment on table public.projects is
  'Proyecto: el trabajo que nace de una contratación al completar el alta (T-32). Uno por contratación. 6 años.';

create index projects_organization_id_idx on public.projects (organization_id, created_at desc);

create function public.project_transition_allowed(p_from public.project_status, p_to public.project_status)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('briefing', 'diseno'), ('briefing', 'mantenimiento'),
    ('diseno', 'desarrollo'),
    ('desarrollo', 'revision'), ('revision', 'desarrollo'), ('revision', 'lanzado'),
    ('lanzado', 'mantenimiento')
  )
  or (p_to = 'en_pausa' and p_from not in ('en_pausa', 'cancelado'))
  or (p_from = 'en_pausa' and p_to not in ('en_pausa'))
  or (p_to = 'cancelado' and p_from <> 'cancelado');
$$;

comment on function public.project_transition_allowed(public.project_status, public.project_status) is
  'Transiciones permitidas de un proyecto (docs/ARCHITECTURE.md §20).';

create function public.projects_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.organization_id, new.engagement_id, new.created_at)
     is distinct from (old.organization_id, old.engagement_id, old.created_at) then
    raise exception 'Estos campos de un proyecto no se cambian' using errcode = 'P0001';
  end if;
  new.name := btrim(new.name);
  if new.status is distinct from old.status then
    if not public.project_transition_allowed(old.status, new.status) then
      raise exception 'Transición no permitida: % → %', old.status, new.status using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.projects_before_update() from public, anon, authenticated;

create trigger projects_before_update
  before update on public.projects
  for each row execute function public.projects_before_update();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create function public.projects_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('project.created', new.organization_id,
      jsonb_build_object('project_id', new.id, 'engagement_id', new.engagement_id));
  elsif new.status is distinct from old.status then
    perform public.write_audit('project.status_changed', new.organization_id,
      jsonb_build_object('project_id', new.id, 'from', old.status, 'to', new.status));
  end if;
  return null;
end;
$$;
revoke execute on function public.projects_audit() from public, anon, authenticated;

create trigger projects_audit
  after insert or update of status on public.projects
  for each row execute function public.projects_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Briefing del proyecto
-- ─────────────────────────────────────────────────────────────────────────────
create table public.project_briefing_items (
  id              uuid primary key default public.uuidv7(),
  project_id      uuid not null references public.projects (id) on delete restrict,
  -- Copia de la del proyecto, para que la RLS no tenga que cruzar tablas.
  organization_id uuid not null references public.organizations (id) on delete restrict,
  position        integer not null,
  section         text not null,
  kind            public.briefing_kind not null,
  label           text not null,
  help            text,
  required        boolean not null,
  status          public.briefing_status not null default 'pendiente',
  value           text check (value is null or char_length(value) <= 10000),
  staff_note      text check (staff_note is null or char_length(staff_note) <= 1000),
  answered_at     timestamptz,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint project_briefing_items_position unique (project_id, position)
);

comment on table public.project_briefing_items is
  'Elementos del briefing de un proyecto (copiados de la plantilla del servicio). Los rellena el cliente; R3ZON valida o pide cambios.';

create index project_briefing_items_organization_id_idx on public.project_briefing_items (organization_id);

create function public.project_briefing_items_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_staff boolean := public.is_staff();
  v_estado_proyecto public.project_status;
begin
  select p.status into v_estado_proyecto from public.projects p where p.id = new.project_id;
  if v_estado_proyecto = 'cancelado' then
    raise exception 'El proyecto está cancelado' using errcode = 'P0001';
  end if;

  if not v_staff then
    if new.staff_note is distinct from old.staff_note then
      raise exception 'Las notas las escribe R3ZON' using errcode = '42501';
    end if;
    if old.status = 'validado' then
      raise exception 'R3ZON ya lo ha validado: si quieres cambiarlo, díselo' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status and new.status not in ('aportado', 'mas_tarde', 'no_aplica') then
      raise exception 'Estado no permitido' using errcode = '42501';
    end if;
  end if;

  if new.status = 'no_aplica' and new.required then
    raise exception 'Este elemento es obligatorio: no se puede marcar como «no aplica»' using errcode = 'P0001';
  end if;
  if new.status = 'cambios' and new.status is distinct from old.status
     and coalesce(btrim(new.staff_note), '') = '' then
    raise exception 'Escribe qué hay que cambiar' using errcode = 'P0001';
  end if;
  if new.status = 'validado' and new.status is distinct from old.status and old.status <> 'aportado' then
    raise exception 'Solo se valida lo aportado' using errcode = 'P0001';
  end if;

  -- Lo aportado se comprueba según su tipo. Al aportar de nuevo, la nota vieja sobra.
  if new.status = 'aportado' and (new.status, new.value) is distinct from (old.status, old.value) then
    new.value := btrim(new.value);
    if coalesce(new.value, '') = '' then
      raise exception 'Escribe tu respuesta' using errcode = 'P0001';
    end if;
    if new.kind = 'color' then
      if new.value !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Escribe el color en hexadecimal, p. ej. #1A2B3C' using errcode = 'P0001';
      end if;
      new.value := lower(new.value);
    elsif new.kind = 'enlace' then
      if new.value !~ '^https?://[^[:space:]]+$' or char_length(new.value) > 2000 then
        raise exception 'Escribe un enlace que empiece por https://' using errcode = 'P0001';
      end if;
    elsif new.kind = 'tipografia' and char_length(new.value) > 200 then
      raise exception 'El nombre de la tipografía es demasiado largo' using errcode = 'P0001';
    end if;
    new.answered_at := now();
    if not v_staff then
      new.staff_note := null;
    end if;
  end if;

  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function public.project_briefing_items_before_update() from public, anon, authenticated;

create trigger project_briefing_items_before_update
  before update on public.project_briefing_items
  for each row execute function public.project_briefing_items_before_update();

create trigger project_briefing_items_set_updated_at
  before update on public.project_briefing_items
  for each row execute function public.set_updated_at();

-- Registro: cambios de estado, sin el contenido (puede ser dato personal).
create function public.project_briefing_items_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit('briefing.' || new.status::text, new.organization_id,
    jsonb_build_object('project_id', new.project_id, 'item_id', new.id, 'from', old.status));
  return null;
end;
$$;
revoke execute on function public.project_briefing_items_audit() from public, anon, authenticated;

create trigger project_briefing_items_audit
  after update of status on public.project_briefing_items
  for each row when (old.status is distinct from new.status)
  execute function public.project_briefing_items_audit();

-- Progreso: obligatorios resueltos (aportado, validado; los opcionales también
-- cuentan como resueltos con «no aplica»).
create view public.project_briefing_progress
with (security_invoker = true) as
  select
    p.id as project_id,
    p.organization_id,
    count(i.id)::int as total,
    count(i.id) filter (where i.required)::int as required_total,
    count(i.id) filter (where i.status in ('aportado', 'validado', 'no_aplica'))::int as done,
    count(i.id) filter (where i.required and i.status in ('aportado', 'validado'))::int as required_done,
    count(i.id) filter (where i.status = 'cambios')::int as changes_requested,
    count(i.id) filter (where i.status = 'aportado')::int as to_review
  from public.projects p
  left join public.project_briefing_items i on i.project_id = p.id
  group by p.id, p.organization_id;

comment on view public.project_briefing_progress is
  'Progreso del briefing de cada proyecto. Derivado; security_invoker.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Nacimiento del proyecto (T-32)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cuando el cliente completa su alta: datos dados y, si firma en el portal,
-- firmado. `activa` también cuenta (R3ZON puede activar sin que el cliente
-- haya pasado por el portal). Definer: el cliente que confirma sus datos no
-- puede crear proyectos ni leer la plantilla. Idempotente.
create function public.engagements_create_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_nombre text;
begin
  if not (new.status in ('firmada', 'activa') or (new.status = 'datos_completos' and not new.requires_signature)) then
    return null;
  end if;
  if exists (select 1 from public.projects p where p.engagement_id = new.id) then
    return null;
  end if;

  -- Nombre: los servicios de las condiciones vigentes, en su orden.
  select left(string_agg(l.name, ', ' order by l.position), 200) into v_nombre
    from public.engagement_lines l where l.revision_id = new.current_revision_id;

  insert into public.projects (organization_id, engagement_id, name)
  values (new.organization_id, new.id, coalesce(v_nombre, 'Proyecto'))
  returning id into v_project;

  -- Briefing: las plantillas de los servicios del catálogo de los que salió
  -- alguna línea (cada servicio una vez), en el orden de las líneas.
  insert into public.project_briefing_items
    (project_id, organization_id, position, section, kind, label, help, required)
  select v_project, new.organization_id,
         row_number() over (order by sv.primera, t.position), t.section, t.kind, t.label, t.help, t.required
    from (select v.service_id, min(l.position) as primera
            from public.engagement_lines l join public.service_versions v on v.id = l.service_version_id
           where l.revision_id = new.current_revision_id
           group by v.service_id) sv
    join public.service_briefing_items t on t.service_id = sv.service_id;
  return null;
end;
$$;
revoke execute on function public.engagements_create_project() from public, anon, authenticated;

create trigger engagements_create_project
  after update of status, requires_signature on public.engagements
  for each row execute function public.engagements_create_project();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Privilegios y RLS
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on table public.service_briefing_items, public.projects, public.project_briefing_items,
  public.project_briefing_progress from anon, authenticated;

grant select, insert (service_id, section, kind, label, help, required), delete
  on table public.service_briefing_items to authenticated;
grant select, update (name, status) on table public.projects to authenticated;
grant select, update (status, value, staff_note) on table public.project_briefing_items to authenticated;
grant select on table public.project_briefing_progress to authenticated;

alter table public.service_briefing_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_briefing_items enable row level security;

-- Plantilla: la ve el equipo y la edita admin (como el catálogo).
create policy service_briefing_items_select_staff
  on public.service_briefing_items for select
  to authenticated
  using ((select public.is_staff()));

create policy service_briefing_items_insert_admin
  on public.service_briefing_items for insert
  to authenticated
  with check ((select public.is_admin()));

create policy service_briefing_items_delete_admin
  on public.service_briefing_items for delete
  to authenticated
  using ((select public.is_admin()));

-- Proyectos: los ve su empresa; los mueve el equipo. Nadie los crea a mano.
create policy projects_select
  on public.projects for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

create policy projects_update_staff
  on public.projects for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Briefing: lo ve su empresa; lo escriben propietario y miembros (facturación
-- solo lee) y el equipo. Qué cambio se permite lo decide el trigger.
create policy project_briefing_items_select
  on public.project_briefing_items for select
  to authenticated
  using ((select public.is_staff()) or public.is_org_member(organization_id));

create policy project_briefing_items_update
  on public.project_briefing_items for update
  to authenticated
  using ((select public.is_staff()) or public.org_role_of(organization_id) in ('owner', 'member'))
  with check ((select public.is_staff()) or public.org_role_of(organization_id) in ('owner', 'member'));
