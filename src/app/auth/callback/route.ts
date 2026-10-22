import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { project } from "@/config/project";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const log = logger("auth/callback");

const OTP_TYPES: ReadonlySet<string> = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Destino de los enlaces que envía Supabase Auth (confirmar email, invitación,
 * recuperar contraseña). Cambia el código o el token por una sesión y redirige
 * a `?next=`, que solo puede ser una ruta del propio sitio.
 *
 * Acepta las dos formas que genera Supabase: `?code=` (PKCE) y
 * `?token_hash=&type=` (plantillas de email con `{{ .TokenHash }}`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), project.homePath);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();
  let error: { code?: string; status?: number } | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    }));
  } else {
    error = { code: "missing_params" };
  }

  if (error) {
    log.warn("callback_failed", { code: error.code, status: error.status });
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
