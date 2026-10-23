import type { Metadata } from "next";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Card } from "@/components/ui/Card";
import { misEmpresas } from "@/modulos/organizaciones/servidor";
import { ResumenProyectos } from "@/modulos/proyectos/servidor";

export const metadata: Metadata = { title: "Proyectos" };

/** Proyectos del cliente, por empresa. Un proyecto nace al completar el alta (T-32). */
export default function ProyectosPage() {
  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Proyectos"
        descripcion="Tus proyectos con R3ZON y lo que nos falta de tu briefing."
      />
      <ModuloSeguro nombre="Tus proyectos">
        <PorEmpresa />
      </ModuloSeguro>
    </div>
  );
}

async function PorEmpresa() {
  const empresas = await misEmpresas();
  if (!empresas.ok) return <BloqueNoDisponible nombre="Tus proyectos" />;
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
          <h2 id={`empresa-${e.id}`} className="text-lg font-semibold">
            {e.name}
          </h2>
          <ModuloSeguro nombre="Sus proyectos">
            <ResumenProyectos organizationId={e.id} vacio />
          </ModuloSeguro>
        </section>
      ))}
    </div>
  );
}
