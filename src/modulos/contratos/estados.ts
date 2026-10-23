import type { Database } from "@/lib/database.types";

export type EstadoContrato = Database["public"]["Enums"]["contract_status"];

export const ESTADOS_CONTRATO: Record<
  EstadoContrato,
  { etiqueta: string; tono: "neutral" | "brand" | "success" | "warning" | "danger" }
> = {
  borrador: { etiqueta: "Borrador", tono: "neutral" },
  enviado: { etiqueta: "Pendiente de firma", tono: "warning" },
  firmado: { etiqueta: "Firmado", tono: "success" },
  anulado: { etiqueta: "Anulado", tono: "neutral" },
  sustituido: { etiqueta: "Sustituido", tono: "neutral" },
};
