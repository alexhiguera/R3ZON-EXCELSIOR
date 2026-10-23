import type { Database } from "@/lib/database.types";

/**
 * Estados de una contratación para la interfaz: etiqueta, tono y etapa del
 * embudo. Las TRANSICIONES no se deciden aquí: las aplica la base
 * (engagement_transition_allowed). Esto solo las refleja para enseñar botones.
 */

export type Estado = Database["public"]["Enums"]["engagement_status"];
type Tono = "neutral" | "brand" | "success" | "warning" | "danger";

export const ESTADOS: Record<Estado, { etiqueta: string; tono: Tono }> = {
  borrador: { etiqueta: "Borrador", tono: "neutral" },
  invitada: { etiqueta: "Invitada", tono: "brand" },
  datos_completos: { etiqueta: "Datos completos", tono: "brand" },
  firmada: { etiqueta: "Firmada", tono: "brand" },
  pago_en_curso: { etiqueta: "Pago en curso", tono: "warning" },
  pagada: { etiqueta: "Pagada", tono: "success" },
  activa: { etiqueta: "Activa", tono: "success" },
  finalizada: { etiqueta: "Finalizada", tono: "neutral" },
  cancelada: { etiqueta: "Cancelada", tono: "neutral" },
  rescindida: { etiqueta: "Rescindida", tono: "danger" },
  en_impago: { etiqueta: "En impago", tono: "danger" },
};

/** Transiciones de la base, repetidas para la interfaz. Un test las compara. */
export const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  borrador: ["invitada", "cancelada"],
  invitada: ["datos_completos", "cancelada"],
  datos_completos: ["firmada", "cancelada"],
  firmada: ["pago_en_curso", "rescindida"],
  pago_en_curso: ["pagada", "en_impago", "rescindida"],
  pagada: ["activa", "en_impago", "rescindida"],
  activa: ["finalizada", "en_impago", "rescindida"],
  en_impago: ["pago_en_curso", "activa", "rescindida"],
  finalizada: [],
  cancelada: [],
  rescindida: [],
};

/**
 * Cierres que el equipo puede hacer a mano desde el panel en la Fase 2. El
 * resto de transiciones las provocan pasos del cliente (fase 3) o del pago
 * (fase 4), no un botón.
 */
export const CIERRES_MANUALES: readonly Estado[] = ["cancelada", "rescindida"];

export const ETAPAS = [
  { id: "invitado", etiqueta: "Invitado" },
  { id: "cuenta", etiqueta: "Cuenta creada" },
  { id: "datos", etiqueta: "Datos completos" },
  { id: "firmado", etiqueta: "Contrato firmado" },
  { id: "pago", etiqueta: "Pago en curso" },
  { id: "en_marcha", etiqueta: "Pagado y en marcha" },
] as const;

export type Etapa = (typeof ETAPAS)[number]["id"];

/**
 * Etapa del embudo de onboarding. «Cuenta creada» no es un estado: se deriva
 * de la invitación aceptada. Las contrataciones cerradas (finalizada,
 * cancelada, rescindida) o en borrador no están en el embudo.
 */
export function etapaEmbudo(estado: Estado, invitacionAceptada: boolean): Etapa | null {
  switch (estado) {
    case "invitada":
      return invitacionAceptada ? "cuenta" : "invitado";
    case "datos_completos":
      return "datos";
    case "firmada":
      return "firmado";
    case "pago_en_curso":
    case "en_impago":
      return "pago";
    case "pagada":
    case "activa":
      return "en_marcha";
    default:
      return null;
  }
}
