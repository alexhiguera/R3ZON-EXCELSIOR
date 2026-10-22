/**
 * Lógica pura de las invitaciones del lado de la app. Las REGLAS (quién puede
 * entrar, caducidad, un solo uso, email) están en la base: el hook
 * `before_user_created` y el trigger `invitations_guard_transition`
 * (docs/AUTH.md). Aquí solo hay formato y mensajes.
 */

/** Formato del token que genera `create_invitation`: 32 bytes en hexadecimal. */
export function tieneFormatoDeToken(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

export const MENSAJE_INVITACION_NO_VALIDA =
  "No hemos podido usar esta invitación. Comprueba que escribes el email al que te la enviamos. Si el enlace ha caducado o ya lo usaste, pide a R3ZON uno nuevo.";

/**
 * Mensaje para el usuario a partir del error de `auth.signUp`. El rechazo del
 * hook llega como 403 y su texto no se muestra tal cual: el nuestro dice qué
 * hacer.
 */
export function mensajeErrorAlta(error: { code?: string; status?: number }): string {
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return "Ya hay una cuenta con este email. Inicia sesión para aceptar la invitación.";
  }
  if (error.code === "weak_password") {
    return "Elige una contraseña más segura, de al menos 8 caracteres.";
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }
  return MENSAJE_INVITACION_NO_VALIDA;
}

/** Mensaje a partir del error de la RPC `accept_invitation`. */
export function mensajeErrorAceptar(mensaje: string | undefined): string {
  if (mensaje?.includes("otro email")) {
    return "Esta invitación es para otro email. Cierra sesión y entra con la cuenta de ese email.";
  }
  return "Esta invitación no es válida: ha caducado, ya se usó o se ha anulado. Pide a R3ZON una nueva.";
}
