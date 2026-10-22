import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del cliente. Lee su propio perfil (el filtro por id elige la fila, no
 * protege nada: el staff puede ver todos los perfiles y un cliente solo el suyo,
 * y eso lo decide la RLS) y las empresas a las que pertenece, sin filtrar: la
 * RLS solo devuelve las suyas.
 *
 * Los pendientes (firmar, pagar, aportar materiales) llegan con las fases 3–6
 * (docs/PLAN.md).
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: empresas } = await supabase.from("organizations").select("id, name").order("name");

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

      {empresas && empresas.length > 0 && (
        <section aria-labelledby="empresas" className="flex flex-col gap-3">
          <h2 id="empresas" className="text-sm font-medium text-muted">
            {empresas.length === 1 ? "Tu empresa" : "Tus empresas"}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {empresas.map((e) => (
              <li key={e.id}>
                <Card className="p-4 sm:p-5">
                  <p className="font-medium" data-testid="empresa">
                    {e.name}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

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
