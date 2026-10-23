/**
 * Política de contraseñas. Tiene que coincidir con `minimum_password_length` de
 * supabase/config.toml (y con el panel de Supabase Cloud): la base es quien la
 * aplica; esto solo avisa antes en el formulario. Un test compara los dos.
 *
 * 12 caracteres (2026-10-23): NIST SP 800-63B pide 15 para una contraseña que
 * es el único factor y 8 con segundo factor. Los clientes entran solo con
 * contraseña y el equipo tendrá 2FA obligatorio: 12 es el término medio
 * acordado. 72 es el límite real de bcrypt, el que usa Supabase Auth.
 */
export const LONGITUD_MINIMA_CONTRASENA = 12;
export const LONGITUD_MAXIMA_CONTRASENA = 72;
