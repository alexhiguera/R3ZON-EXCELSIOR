import type { Metadata } from "next";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Card } from "@/components/ui/Card";
import { esStaff, nivelActual } from "@/lib/auth/nivel";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ResumenContrataciones } from "@/modulos/contrataciones/servidor";
import { misEmpresas } from "@/modulos/organizaciones/servidor";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio. Para un cliente: cada empresa con sus servicios y el siguiente paso
 * de cada uno. Cada bloque va en `ModuloSeguro`: si un módulo falla, su bloque
 * dice «no disponible» y el resto sigue (docs/ARCHITECTURE.md §21).
 *
 * El perfil se lee por id (el filtro elige la fila; quién puede verla lo decide
 * la RLS: el staff ve todos los perfiles y un cliente solo el suyo).
 */
export default async function InicioPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profile }, nivel] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
    nivelActual(),
  ]);

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

      {esStaff(nivel) ? (
        <Card>
          <h2 className="text-lg font-semibold">Equipo de R3ZON</h2>
          <p className="mt-1 text-sm text-muted">
            Clientes, contrataciones, contratos y servicios están en el menú.
          </p>
        </Card>
      ) : (
        <ModuloSeguro nombre="Tus empresas">
          <Empresas />
        </ModuloSeguro>
      )}
    </div>
  );
}

async function Empresas() {
  const empresas = await misEmpresas();
  if (!empresas.ok) return <BloqueNoDisponible nombre="Tus empresas" />;
  if (empresas.datos.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Todavía no perteneces a ninguna empresa.</p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {empresas.datos.map((e) => (
        <section key={e.id} aria-labelledby={`empresa-${e.id}`} className="flex flex-col gap-3">
          <h2 id={`empresa-${e.id}`} className="text-lg font-semibold" data-testid="empresa">
            {e.name}
          </h2>
          <ModuloSeguro nombre="Tus servicios">
            <ResumenContrataciones organizationId={e.id} />
          </ModuloSeguro>
        </section>
      ))}
    </div>
  );
}
