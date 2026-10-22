import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Página protegida mínima. Lee el perfil del usuario SIN filtrar por id: la RLS
 * de `profiles` solo deja ver la fila propia, así que `.single()` devuelve la
 * suya. Es la demostración, de punta a punta, de que el frontend no filtra a
 * mano y la base hace de verja.
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, created_at")
    .single();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">
        Hola{profile?.display_name ? `, ${profile.display_name}` : ""}
      </h1>
      <p className="text-muted">
        Has iniciado sesión como <strong data-testid="user-email">{user?.email}</strong>.
      </p>
    </section>
  );
}
