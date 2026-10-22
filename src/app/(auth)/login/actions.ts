"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { project } from "@/config/project";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const log = logger("auth/login");

export type LoginState = { error: string | null };

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Inicio de sesión con email y contraseña.
 *
 * El mensaje de error es el mismo para «no existe» y «contraseña incorrecta»:
 * distinguirlos le dice a cualquiera qué emails tienen cuenta.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Escribe un email válido y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.warn("sign_in_failed", { code: error.code, status: error.status });
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(safeRedirectPath(formData.get("redirect")?.toString(), project.homePath));
}
