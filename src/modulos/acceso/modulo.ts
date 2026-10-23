import type { DefinicionModulo } from "../tipos";

/** Acceso no añade secciones al menú: sus páginas son públicas (login, invitación). */
export const moduloAcceso: DefinicionModulo = { id: "acceso", nombre: "Acceso", navegacion: [] };
