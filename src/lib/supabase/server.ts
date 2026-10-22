import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Usa la clave PUBLICABLE y la sesión del usuario: todo lo que hace pasa por
 * RLS. La `service_role` no se usa nunca en código de la app (solo en scripts
 * locales y en CI), porque se salta la RLS entera.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. No pasa nada: el
            // proxy ya ha refrescado la sesión en esta misma petición.
          }
        },
      },
    },
  );
}

/**
 * Usuario de la petición actual, memoizado por render: el layout y la página
 * lo piden los dos y así solo se pregunta a Supabase una vez.
 *
 * `getUser()` y no `getSession()`: el primero valida el token contra Supabase;
 * el segundo se fía de lo que diga la cookie.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
