import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del cliente. Lee el perfil SIN filtrar por id: la RLS de `profiles`
 * solo deja ver la fila propia, así que `.single()` devuelve la suya. Es la
 * demostración, de punta a punta, de que el frontend no filtra a mano y la base
 * hace de verja.
 *
 * Los pendientes (firmar, pagar, aportar materiales) llegan con las fases 3–6
 * (docs/PLAN.md).
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, created_at")
    .single();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs tracking-[0.2em] text-lavender uppercase">Área de clientes</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Hola{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-muted">
          Has iniciado sesión como <strong data-testid="user-email">{user?.email}</strong>.
        </p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold">Todo al día</h2>
        <p className="mt-1 text-sm text-muted">
          Aquí verás lo que tengas pendiente: contratos por firmar, pagos y materiales para tu
          proyecto.
        </p>
      </Card>
    </div>
  );
}
