"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para Client Components. Misma regla que en servidor:
 * clave publicable, sesión del usuario y RLS como única verja. El frontend no
 * filtra por usuario ni por tenant a mano.
 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
