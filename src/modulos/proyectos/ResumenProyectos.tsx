import "server-only";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { listarProyectos } from "./datos";
import { ESTADOS_PROYECTO, porcentaje } from "./estados";

/**
 * Proyectos de una empresa tal como los ve el cliente, con el progreso del
 * briefing. Lo usan su inicio, su página de proyectos y la «vista de cliente»
 * del equipo (T-22); con `soloLectura`, sin enlaces de acción. Sin proyectos
 * no pinta nada (el inicio ya dice qué falta del alta), salvo con `vacio`.
 */
export async function ResumenProyectos({
  organizationId,
  soloLectura = false,
  vacio = false,
}: {
  organizationId: string;
  soloLectura?: boolean;
  /** Decir «todavía no hay proyectos» en vez de no pintar nada. */
  vacio?: boolean;
}) {
  const r = await listarProyectos({ organizationId });
  if (!r.ok) return <BloqueNoDisponible nombre="Tus proyectos" />;
  if (r.datos.length === 0) {
    return vacio ? (
      <p className="text-sm text-muted">
        Todavía no hay proyectos: empiezan cuando completas el alta de un servicio.
      </p>
    ) : null;
  }

  return (
    <ul className="flex flex-col gap-3">
      {r.datos.map((p) => {
        const pct = porcentaje(p.progreso);
        return (
          <li key={p.id}>
            <Card className="flex flex-col gap-3 p-4 sm:p-5" data-testid="proyecto-cliente">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">Proyecto: {p.name}</span>
                <Badge tone={ESTADOS_PROYECTO[p.status].tono}>
                  {ESTADOS_PROYECTO[p.status].etiqueta}
                </Badge>
              </div>
              {p.progreso.total > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-muted">Briefing: {pct} %</p>
                  <div
                    role="progressbar"
                    aria-label="Briefing completado"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  {p.progreso.changes_requested > 0 && (
                    <p className="text-sm">
                      R3ZON te ha pedido cambios en {p.progreso.changes_requested}{" "}
                      {p.progreso.changes_requested === 1 ? "elemento" : "elementos"}.
                    </p>
                  )}
                </div>
              )}
              {!soloLectura && p.progreso.total > 0 && (
                <Link
                  href={`/proyectos/${p.id}`}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {pct < 100 ? "Completar el briefing" : "Ver el briefing"}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
