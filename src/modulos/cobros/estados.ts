import type { Database } from "@/lib/database.types";

/**
 * Estado ECONÓMICO de una contratación, para la interfaz. Va aparte del
 * contractual (T-26): una contratación puede estar firmada y sin pagar, o
 * pagada y sin firmar. El estado lo calcula la base (vista
 * engagement_collections); aquí solo etiquetas.
 */

type Tono = "neutral" | "brand" | "success" | "warning" | "danger";

export type EstadoCobro = Database["public"]["Enums"]["collection_status"];

export const ESTADOS_COBRO: Record<EstadoCobro, { etiqueta: string; tono: Tono }> = {
  no_pagado: { etiqueta: "Sin pagar", tono: "warning" },
  parcialmente_pagado: { etiqueta: "Pago parcial", tono: "brand" },
  pagado: { etiqueta: "Pagado", tono: "success" },
  pendiente_revision: { etiqueta: "Pendiente de revisión", tono: "danger" },
};

export type MetodoCobro = Database["public"]["Enums"]["payment_method"];

/** Métodos que registra el EQUIPO (cobros externos). Sin efectivo (T-28). */
export const METODOS_EXTERNOS: readonly {
  valor: Exclude<MetodoCobro, "stripe">;
  etiqueta: string;
}[] = [
  { valor: "transferencia", etiqueta: "Transferencia bancaria directa" },
  { valor: "otro", etiqueta: "Otro método documentado" },
];

export const ETIQUETA_METODO: Record<MetodoCobro, string> = {
  transferencia: "Transferencia",
  otro: "Otro",
  stripe: "Pago online",
};

export type EstadoPago = Database["public"]["Enums"]["payment_status"];

export const ESTADOS_PAGO: Record<EstadoPago, { etiqueta: string; tono: Tono }> = {
  pendiente: { etiqueta: "En curso", tono: "warning" },
  confirmado: { etiqueta: "Cobrado", tono: "success" },
  fallido: { etiqueta: "Fallido", tono: "danger" },
  devuelto: { etiqueta: "Devuelto", tono: "danger" },
  anulado: { etiqueta: "Anulado", tono: "neutral" },
};
