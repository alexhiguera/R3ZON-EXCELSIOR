import type { Database } from "@/lib/database.types";

/**
 * Estados de un proyecto y de cada elemento de su briefing, para la interfaz.
 * Las reglas las aplica la base (project_transition_allowed y el trigger del
 * briefing); esto solo las refleja para enseñar botones. Un test compara las
 * transiciones con las de la base.
 */

export type EstadoProyecto = Database["public"]["Enums"]["project_status"];
export type EstadoElemento = Database["public"]["Enums"]["briefing_status"];
export type TipoElemento = Database["public"]["Enums"]["briefing_kind"];
type Tono = "neutral" | "brand" | "success" | "warning" | "danger";

export const ESTADOS_PROYECTO: Record<EstadoProyecto, { etiqueta: string; tono: Tono }> = {
  briefing: { etiqueta: "Briefing", tono: "brand" },
  diseno: { etiqueta: "Diseño", tono: "brand" },
  desarrollo: { etiqueta: "Desarrollo", tono: "brand" },
  revision: { etiqueta: "Revisión", tono: "brand" },
  lanzado: { etiqueta: "Lanzado", tono: "success" },
  mantenimiento: { etiqueta: "Mantenimiento", tono: "success" },
  en_pausa: { etiqueta: "En pausa", tono: "warning" },
  cancelado: { etiqueta: "Cancelado", tono: "neutral" },
};

const ACTIVOS: readonly EstadoProyecto[] = [
  "briefing",
  "diseno",
  "desarrollo",
  "revision",
  "lanzado",
  "mantenimiento",
];

/** Transiciones de la base, repetidas para la interfaz. Un test las compara. */
export const TRANSICIONES_PROYECTO: Record<EstadoProyecto, readonly EstadoProyecto[]> = {
  briefing: ["diseno", "mantenimiento", "en_pausa", "cancelado"],
  diseno: ["desarrollo", "en_pausa", "cancelado"],
  desarrollo: ["revision", "en_pausa", "cancelado"],
  revision: ["desarrollo", "lanzado", "en_pausa", "cancelado"],
  lanzado: ["mantenimiento", "en_pausa", "cancelado"],
  mantenimiento: ["en_pausa", "cancelado"],
  en_pausa: [...ACTIVOS, "cancelado"],
  cancelado: [],
};

export const ESTADOS_ELEMENTO: Record<EstadoElemento, { etiqueta: string; tono: Tono }> = {
  pendiente: { etiqueta: "Pendiente", tono: "neutral" },
  mas_tarde: { etiqueta: "Más tarde", tono: "neutral" },
  no_aplica: { etiqueta: "No aplica", tono: "neutral" },
  aportado: { etiqueta: "Enviado", tono: "brand" },
  cambios: { etiqueta: "Cambios pedidos", tono: "warning" },
  validado: { etiqueta: "Validado", tono: "success" },
};

export const TIPOS_ELEMENTO: Record<TipoElemento, string> = {
  texto: "Texto",
  color: "Color",
  tipografia: "Tipografía",
  enlace: "Enlace",
};

/** ¿Puede el cliente escribir en este elemento? (La base lo vuelve a decidir.) */
export function editablePorCliente(estado: EstadoElemento, proyecto: EstadoProyecto): boolean {
  return estado !== "validado" && proyecto !== "cancelado";
}

export type Progreso = {
  total: number;
  required_total: number;
  done: number;
  required_done: number;
  changes_requested: number;
  to_review: number;
};

/** Porcentaje del briefing: lo obligatorio aportado (o todo, si nada es obligatorio). */
export function porcentaje(p: Progreso): number {
  if (p.required_total > 0) return Math.round((p.required_done / p.required_total) * 100);
  if (p.total > 0) return Math.round((p.done / p.total) * 100);
  return 100;
}

/** Agrupa elementos por sección conservando el orden en que aparecen. */
export function porSeccion<T extends { section: string }>(
  elementos: readonly T[],
): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const e of elementos) {
    const g = grupos.get(e.section);
    if (g) g.push(e);
    else grupos.set(e.section, [e]);
  }
  return [...grupos.entries()];
}
