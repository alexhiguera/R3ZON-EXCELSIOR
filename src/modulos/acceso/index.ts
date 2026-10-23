/**
 * Módulo ACCESO: alta por invitación, login con Google. API pública del módulo:
 * el resto de la app importa de aquí, nunca de sus ficheros internos
 * (tests/unit/modulos.test.ts lo vigila).
 */
export { GoogleButton } from "./componentes/GoogleButton";
export { Separador } from "./componentes/Separador";
export {
  MENSAJE_INVITACION_NO_VALIDA,
  mensajeErrorAceptar,
  mensajeErrorAlta,
  tieneFormatoDeToken,
} from "./invitaciones";

/** Enlace de invitación a partir del origen y el token. */
export function enlaceInvitacion(origen: string, token: string): string {
  return `${origen.replace(/\/$/, "")}/invitacion/${token}`;
}
