import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";
import type { EstadoElemento, EstadoProyecto, Progreso, TipoElemento } from "./estados";

/*
 * Proyectos y briefing. Quién ve qué: la RLS (su empresa o el equipo). Quién
 * escribe qué y qué cambio vale: el trigger del briefing. Aquí solo se traduce.
 */

export type Proyecto = {
  id: string;
  organization_id: string;
  engagement_id: string;
  name: string;
  status: EstadoProyecto;
  created_at: string;
  status_changed_at: string;
  cliente: string;
  progreso: Progreso;
};

const SIN_PROGRESO: Progreso = {
  total: 0,
  required_total: 0,
  done: 0,
  required_done: 0,
  changes_requested: 0,
  to_review: 0,
};

type FilaProyecto = Omit<Proyecto, "cliente" | "progreso"> & {
  organizations: { name: string } | null;
};

/** Proyectos visibles (el staff, todos; un cliente, los de sus empresas). */
export async function listarProyectos(
  filtro: { organizationId?: string } = {},
): Promise<Resultado<Proyecto[]>> {
  const supabase = await createClient();
  let consulta = supabase
    .from("projects")
    .select(
      "id, organization_id, engagement_id, name, status, created_at, status_changed_at, organizations(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filtro.organizationId) consulta = consulta.eq("organization_id", filtro.organizationId);
  const r = await leer("proyectos", "listar", consulta);
  if (!r.ok) return r;
  const filas = r.datos as unknown as FilaProyecto[];
  const progreso = await progresos(filas.map((f) => f.id));
  return {
    ok: true,
    datos: filas.map(({ organizations, ...f }) => ({
      ...f,
      cliente: organizations?.name ?? "—",
      // Si el progreso falla, el proyecto se sigue viendo (sin porcentaje).
      progreso: (progreso.ok && progreso.datos.get(f.id)) || SIN_PROGRESO,
    })),
  };
}

async function progresos(ids: string[]): Promise<Resultado<Map<string, Progreso>>> {
  if (ids.length === 0) return { ok: true, datos: new Map() };
  const supabase = await createClient();
  const r = await leer(
    "proyectos",
    "progreso",
    supabase
      .from("project_briefing_progress")
      .select(
        "project_id, total, required_total, done, required_done, changes_requested, to_review",
      )
      .in("project_id", ids),
  );
  if (!r.ok) return r;
  return {
    ok: true,
    datos: new Map(
      (r.datos as (Progreso & { project_id: string })[]).map(({ project_id, ...p }) => [
        project_id,
        p,
      ]),
    ),
  };
}

export type Elemento = {
  id: string;
  position: number;
  section: string;
  kind: TipoElemento;
  label: string;
  help: string | null;
  required: boolean;
  status: EstadoElemento;
  value: string | null;
  staff_note: string | null;
  answered_at: string | null;
};

export type DetalleProyecto = Proyecto & { elementos: Elemento[] };

export async function proyecto(id: string): Promise<Resultado<DetalleProyecto | null>> {
  const supabase = await createClient();
  const [p, e] = await Promise.all([
    leer(
      "proyectos",
      "detalle",
      supabase
        .from("projects")
        .select(
          "id, organization_id, engagement_id, name, status, created_at, status_changed_at, organizations(name)",
        )
        .eq("id", id)
        .limit(1),
    ),
    leer(
      "proyectos",
      "briefing",
      supabase
        .from("project_briefing_items")
        .select(
          "id, position, section, kind, label, help, required, status, value, staff_note, answered_at",
        )
        .eq("project_id", id)
        .order("position"),
    ),
  ]);
  if (!p.ok) return p;
  if (!e.ok) return e;
  const fila = (p.datos as unknown as FilaProyecto[])[0];
  if (!fila) return { ok: true, datos: null };
  const progreso = await progresos([fila.id]);
  const { organizations, ...resto } = fila;
  return {
    ok: true,
    datos: {
      ...resto,
      cliente: organizations?.name ?? "—",
      progreso: (progreso.ok && progreso.datos.get(fila.id)) || SIN_PROGRESO,
      elementos: e.datos as Elemento[],
    },
  };
}

/** El proyecto que nació de una contratación, si ya existe (T-32). */
export async function proyectoDeContratacion(
  engagementId: string,
): Promise<Resultado<{ id: string } | null>> {
  const supabase = await createClient();
  const r = await leer(
    "proyectos",
    "de_contratacion",
    supabase.from("projects").select("id").eq("engagement_id", engagementId).limit(1),
  );
  return r.ok ? { ok: true, datos: (r.datos as { id: string }[])[0] ?? null } : r;
}

async function actualizarElemento(
  operacion: string,
  id: string,
  cambios: { status?: EstadoElemento; value?: string; staff_note?: string | null },
  mensaje: string,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "proyectos",
    operacion,
    supabase.from("project_briefing_items").update(cambios).eq("id", id).select("id").single(),
    mensaje,
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** El cliente (o el equipo por él) aporta un elemento. La base valida según el tipo. */
export function aportar(id: string, valor: string): Promise<ResultadoAccion<null>> {
  if (!valor.trim()) return Promise.resolve({ ok: false, error: "Escribe tu respuesta." });
  return actualizarElemento(
    "aportar",
    id,
    { status: "aportado", value: valor.slice(0, 10000) },
    "No se ha podido guardar.",
  );
}

/** «Más tarde» o «no aplica» (este, solo en lo opcional: lo decide la base). */
export function aplazar(id: string, estado: "mas_tarde" | "no_aplica") {
  return actualizarElemento("aplazar", id, { status: estado }, "No se ha podido guardar.");
}

/** El equipo valida lo aportado o pide cambios con una nota. */
export function revisarElemento(
  id: string,
  decision: "validado" | "cambios",
  nota: string,
): Promise<ResultadoAccion<null>> {
  return actualizarElemento(
    "revisar",
    id,
    decision === "cambios"
      ? { status: "cambios", staff_note: nota.trim().slice(0, 1000) }
      : { status: "validado" },
    "No se ha podido guardar la revisión.",
  );
}

export async function cambiarEstadoProyecto(
  id: string,
  estado: EstadoProyecto,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "proyectos",
    "cambiar_estado",
    supabase.from("projects").update({ status: estado }).eq("id", id).select("id").single(),
    "No se ha podido cambiar el estado.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/* ───────────────────────────── Plantilla de briefing (admin) ───────────────────────────── */

export type ElementoPlantilla = {
  id: string;
  position: number;
  section: string;
  kind: TipoElemento;
  label: string;
  help: string | null;
  required: boolean;
};

export async function plantillaBriefing(
  serviceId: string,
): Promise<Resultado<ElementoPlantilla[]>> {
  const supabase = await createClient();
  return leer(
    "proyectos",
    "plantilla",
    supabase
      .from("service_briefing_items")
      .select("id, position, section, kind, label, help, required")
      .eq("service_id", serviceId)
      .order("position"),
  );
}

const elementoSchema = z.object({
  seccion: z
    .string()
    .trim()
    .max(60, "La sección es demasiado larga.")
    .transform((s) => s || "General"),
  tipo: z.enum(["texto", "color", "tipografia", "enlace"], "Elige un tipo."),
  etiqueta: z.string().trim().min(1, "Escribe qué se pide.").max(120, "Demasiado largo."),
  ayuda: z.string().trim().max(1000, "La ayuda es demasiado larga."),
  obligatorio: z.boolean(),
});

export async function anadirElementoPlantilla(
  serviceId: string,
  datos: z.input<typeof elementoSchema>,
): Promise<ResultadoAccion<null>> {
  const d = elementoSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir(
    "proyectos",
    "plantilla_anadir",
    supabase
      .from("service_briefing_items")
      .insert({
        service_id: serviceId,
        section: d.data.seccion,
        kind: d.data.tipo,
        label: d.data.etiqueta,
        help: d.data.ayuda || null,
        required: d.data.obligatorio,
        // position la pone la base (al final).
      } as never)
      .select("id")
      .single(),
    "No se ha podido añadir.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function quitarElementoPlantilla(id: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "proyectos",
    "plantilla_quitar",
    supabase.from("service_briefing_items").delete().eq("id", id).select("id").single(),
    "No se ha podido quitar.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}
