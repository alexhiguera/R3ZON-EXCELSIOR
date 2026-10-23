import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fecha } from "@/lib/formato";
import { ESTADOS_PROYECTO, porcentaje } from "@/modulos/proyectos";
import { listarProyectos } from "@/modulos/proyectos/servidor";

export const metadata: Metadata = { title: "Proyectos" };

/** Proyectos de todos los clientes, con el briefing: cuánto falta y qué hay que revisar. */
export default function AdminProyectosPage() {
  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Proyectos"
        descripcion="Nacen cuando el cliente completa su alta. Aquí ves su briefing y lo que falta revisar."
      />
      <ModuloSeguro nombre="Los proyectos">
        <Lista />
      </ModuloSeguro>
    </div>
  );
}

async function Lista() {
  const r = await listarProyectos();
  if (!r.ok) return <BloqueNoDisponible nombre="Los proyectos" />;
  if (r.datos.length === 0) {
    return <p className="text-sm text-muted">Aún no hay proyectos.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {r.datos.map((p) => (
        <li key={p.id}>
          <Card
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            data-testid="fila-proyecto"
          >
            <span className="flex flex-col">
              <Link href={`/admin/proyectos/${p.id}`} className="font-medium hover:underline">
                {p.cliente} · {p.name}
              </Link>
              <span className="text-sm text-muted">
                Briefing {porcentaje(p.progreso)} % · desde el {fecha(p.created_at)}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={ESTADOS_PROYECTO[p.status].tono}>
                {ESTADOS_PROYECTO[p.status].etiqueta}
              </Badge>
              {p.progreso.to_review > 0 && (
                <Badge tone="warning">{p.progreso.to_review} por revisar</Badge>
              )}
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
