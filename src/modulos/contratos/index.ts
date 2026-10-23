/** API pública (cliente y servidor) del módulo CONTRATOS. */
export { ESTADOS_CONTRATO, type EstadoContrato } from "./estados";
export { FirmaDibujada } from "./FirmaDibujada";
export { HUECOS, type Hueco, huecosDesconocidos } from "./huecos";
export { type Bloque, bloques } from "./markdown";
export { TextoContrato } from "./TextoContrato";

/** Referencia corta y legible de un contrato (la misma que pone la base en el texto). */
export function referenciaContrato(id: string): string {
  return id.replace(/-/g, "").slice(0, 12).toUpperCase();
}
