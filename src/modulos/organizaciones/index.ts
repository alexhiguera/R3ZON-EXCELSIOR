/** API pública (cliente y servidor) del módulo ORGANIZACIONES. */

export const ETIQUETA_ROL = {
  owner: "Propietario",
  member: "Miembro",
  billing: "Facturación",
} as const satisfies Record<"owner" | "member" | "billing", string>;

export { esCifValido, esDniONieValido, esNifValido, normalizarNif } from "./nif";
