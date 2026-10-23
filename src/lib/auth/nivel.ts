import "server-only";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type Nivel = Database["public"]["Enums"]["platform_role"];

/**
 * Nivel de plataforma del usuario actual (client | staff | admin), memoizado
 * por render. Solo decide qué INTERFAZ se enseña: lo que cada uno puede leer o
 * escribir lo decide la RLS con `is_staff()` / `is_admin()`
 * (docs/ARCHITECTURE.md §16). Sin sesión o si falla la lectura: `client`, el
 * nivel con menos interfaz.
 */
export const nivelActual = cache(async (): Promise<Nivel> => {
  const user = await getCurrentUser();
  if (!user) return "client";
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.platform_role ?? "client";
});

export const esStaff = (nivel: Nivel) => nivel === "staff" || nivel === "admin";
