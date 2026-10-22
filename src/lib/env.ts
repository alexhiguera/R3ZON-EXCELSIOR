import { z } from "zod";

/**
 * Variables de entorno públicas, validadas una vez.
 *
 * Next.js solo incrusta en el bundle del navegador las `NEXT_PUBLIC_*` escritas
 * LITERALMENTE (`process.env.NEXT_PUBLIC_X`), así que aquí se leen una a una y
 * no con `process.env[nombre]`.
 *
 * Falla con un mensaje que dice qué falta y dónde se configura, en vez del
 * `TypeError: Invalid URL` que da supabase-js dos capas más abajo.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Variables de entorno públicas ausentes o inválidas: ${missing}. ` +
        "En local se rellenan en .env.local (ver .env.example y docs/DEVELOPMENT.md).",
    );
  }
  return result.data;
}

let cached: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}

/**
 * ¿Se ofrece «Continuar con Google»? Opcional: sin la variable, el botón no
 * aparece. Hace falta que el proveedor esté activo en Supabase (en local,
 * `[auth.external.google]` de supabase/config.toml), o el botón llevaría a un
 * error. Escrita literal para que Next la incruste en el navegador.
 */
export function googleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";
}
