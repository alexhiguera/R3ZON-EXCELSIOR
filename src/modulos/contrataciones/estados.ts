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
  activa: { etiqueta: "Activa", tono: "success" },
  finalizada: { etiqueta: "Finalizada", tono: "neutral" },
  cancelada: { etiqueta: "Cancelada", tono: "neutral" },
  rescindida: { etiqueta: "Rescindida", tono: "danger" },
};

/** Transiciones de la base, repetidas para la interfaz. Un test las compara. */
export const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  borrador: ["invitada", "cancelada"],
  invitada: ["datos_completos", "cancelada"],
  datos_completos: ["firmada", "activa", "cancelada"],
  firmada: ["activa", "rescindida"],
  activa: ["finalizada", "rescindida"],
  finalizada: [],
  cancelada: [],
  rescindida: [],
};

/**
 * Cierres que el equipo puede hacer a mano desde el panel. Activar va aparte
 * (botón propio, con aviso del estado de cobro): lo decide R3ZON (T-26).
 */
export const CIERRES_MANUALES: readonly Estado[] = ["cancelada", "rescindida"];

/** ¿Puede el equipo activar ya esta contratación? (la base lo vuelve a comprobar). */
export function puedeActivarse(estado: Estado, pideFirma: boolean): boolean {
  return estado === "firmada" || (estado === "datos_completos" && !pideFirma);
}

export const ETAPAS = [
  { id: "preparando", etiqueta: "Preparando" },
  { id: "invitado", etiqueta: "Invitado" },
  { id: "cuenta", etiqueta: "Cuenta creada" },
  { id: "datos", etiqueta: "Datos completos" },
  { id: "firmado", etiqueta: "Contrato firmado" },
  { id: "en_marcha", etiqueta: "En marcha" },
] as const;

export type Etapa = (typeof ETAPAS)[number]["id"];

/**
 * Etapa CONTRACTUAL del embudo de alta. «Cuenta creada» no es un estado: se
 * deriva de la invitación aceptada. El cobro se enseña aparte (estado de
 * cobro), porque va por su cuenta. Las cerradas no están en el embudo.
 */
export function etapaEmbudo(estado: Estado, invitacionAceptada: boolean): Etapa | null {
  switch (estado) {
    case "borrador":
      return "preparando";
    case "invitada":
      return invitacionAceptada ? "cuenta" : "invitado";
    case "datos_completos":
      return "datos";
    case "firmada":
      return "firmado";
    case "activa":
      return "en_marcha";
    default:
      return null;
  }
}

/**
 * Qué le toca hacer al CLIENTE ahora, combinando el estado contractual y el
 * de cobro (que van por separado). `accion`: hay algo que pueda hacer él
 * (enseñar «Continuar»).
 */
export function pasoCliente(c: {
  status: Estado;
  requiresSignature: boolean;
  requiresPayment: boolean;
  cobro: "no_pagado" | "parcialmente_pagado" | "pagado" | "pendiente_revision" | null;
}): { texto: string; accion: boolean } | null {
  if (c.status === "invitada") return { texto: "Completa los datos de tu empresa.", accion: true };
  if (c.status === "datos_completos" && c.requiresSignature) {
    return { texto: "Revisa y firma tu contrato.", accion: true };
  }
  if (c.status === "datos_completos" || c.status === "firmada") {
    if (c.requiresPayment && c.cobro === "pendiente_revision") {
      return {
        texto: "Estamos revisando tus pagos. Te avisaremos si hace falta algo.",
        accion: false,
      };
    }
    if (c.requiresPayment && (c.cobro === "no_pagado" || c.cobro === "parcialmente_pagado")) {
      return { texto: "Tienes un pago pendiente.", accion: true };
    }
    return { texto: "Todo listo. Te avisaremos al poner en marcha tu proyecto.", accion: false };
  }
  return null;
}

export type PasoAlta = "bienvenida" | "datos" | "contrato" | "pago" | "listo";

/**
 * Pasos del asistente de alta de una contratación, según lo que R3ZON pidió
 * (interruptores) y su estado REAL. `maximo`: el último paso al que se puede
 * ir; `porDefecto`: al que se entra. El pago nunca bloquea «listo»: un cliente
 * que paga fuera o más tarde no se queda atascado.
 */
export function pasosAlta(c: {
  status: Estado;
  requiresSignature: boolean;
  requiresPayment: boolean;
  /** Hay un importe que se le puede pedir ahora (amount_due_now > 0). */
  pagoPendiente: boolean;
}): { pasos: PasoAlta[]; maximo: number; porDefecto: number } {
  const pasos: PasoAlta[] = [
    "bienvenida",
    "datos",
    ...(c.requiresSignature ? (["contrato"] as const) : []),
    ...(c.requiresPayment ? (["pago"] as const) : []),
    "listo",
  ];
  const indice = (p: PasoAlta) => pasos.indexOf(p);
  let maximo = pasos.length - 1;
  if (c.status === "invitada") maximo = indice("datos");
  else if (c.status === "datos_completos" && c.requiresSignature) maximo = indice("contrato");

  let porDefecto = maximo;
  if (c.status === "invitada") porDefecto = 0;
  else if (maximo === pasos.length - 1 && c.requiresPayment && c.pagoPendiente)
    porDefecto = indice("pago");
  return { pasos, maximo, porDefecto };
}
