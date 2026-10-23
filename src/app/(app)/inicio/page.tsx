import type { Metadata } from "next";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Card } from "@/components/ui/Card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { misEmpresas } from "@/modulos/organizaciones/servidor";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio. Cada bloque que viene de un módulo va dentro de `ModuloSeguro`: si
 * ese módulo falla, su bloque dice «no disponible» y el resto de la página
 * sigue en pie (docs/ARCHITECTURE.md §21).
 *
 * El perfil se lee por id (el filtro elige la fila; quién puede verla lo decide
 * la RLS: el staff ve todos los perfiles y un cliente solo el suyo).
 *
 * Los pendientes (firmar, pagar, aportar materiales) llegan con las fases 3–6.
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

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

      <ModuloSeguro nombre="Tus empresas">
        <Empresas />
      </ModuloSeguro>

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

async function Empresas() {
  const empresas = await misEmpresas();
  if (!empresas.ok) return <BloqueNoDisponible nombre="Tus empresas" />;
  if (empresas.datos.length === 0) return null;

  return (
    <section aria-labelledby="empresas" className="flex flex-col gap-3">
      <h2 id="empresas" className="text-sm font-medium text-muted">
        {empresas.datos.length === 1 ? "Tu empresa" : "Tus empresas"}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {empresas.datos.map((e) => (
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
  );
}
