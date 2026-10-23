"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { project } from "@/config/project";
import { LONGITUD_MAXIMA_CONTRASENA, LONGITUD_MINIMA_CONTRASENA } from "@/lib/auth/politica";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  MENSAJE_INVITACION_NO_VALIDA,
  mensajeErrorAceptar,
  mensajeErrorAlta,
  tieneFormatoDeToken,
} from "@/modulos/acceso";

const log = logger("auth/invitacion");

export type InvitacionState = { error: string | null; info?: string | null };

const altaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(LONGITUD_MINIMA_CONTRASENA).max(LONGITUD_MAXIMA_CONTRASENA),
});

/**
 * Crea la cuenta con email y contraseña desde una invitación.
 *
 * El token viaja en los metadatos del alta para que el hook
 * `before_user_created` compruebe que es de ESTE email; la base lo quita antes
 * de guardar el usuario y acepta la invitación en la misma transacción.
 */
export async function crearCuenta(
  token: string,
  _prev: InvitacionState,
  formData: FormData,
): Promise<InvitacionState> {
  if (!tieneFormatoDeToken(token)) return { error: MENSAJE_INVITACION_NO_VALIDA };

  const parsed = altaSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: `Escribe tu nombre, un email válido y una contraseña de al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { invitation_token: token, display_name: parsed.data.nombre } },
  });
  if (error) {
    log.warn("sign_up_failed", { code: error.code, status: error.status });
    return { error: mensajeErrorAlta(error) };
  }

  // Con la confirmación de email desactivada (el token ya prueba que el email es
  // suyo: docs/AUTH.md) el alta trae sesión. Si un entorno la tuviera activada,
  // se avisa en vez de fallar en silencio.
  if (!data.session) {
    log.warn("sign_up_without_session");
    return { error: null, info: "Te hemos enviado un email para confirmar tu cuenta." };
  }
  redirect(project.homePath);
}

/** Acepta la invitación con la cuenta con la que ya se ha iniciado sesión (T-13). */
export async function aceptarInvitacion(
  token: string,
  _prev: InvitacionState,
  _formData: FormData,
): Promise<InvitacionState> {
  if (!tieneFormatoDeToken(token)) return { error: mensajeErrorAceptar(undefined) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    log.warn("accept_failed", { code: error.code });
    return { error: mensajeErrorAceptar(error.message) };
  }
  redirect(project.homePath);
}
