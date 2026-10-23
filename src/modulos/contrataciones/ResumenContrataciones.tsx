import "server-only";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { euros } from "@/lib/formato";
import { ESTADOS_COBRO } from "@/modulos/cobros";
import { resumenCobros } from "@/modulos/cobros/servidor";
import { listarContrataciones } from "./datos";
import { ESTADOS, pasoCliente } from "./estados";

/**
 * Contrataciones de una empresa tal como las ve el CLIENTE. Lo usan su inicio
 * y la «vista de cliente» del equipo (T-22): como es el mismo componente, el
 * equipo ve exactamente lo mismo. Con `soloLectura`, sin enlaces de acción.
 *
 * El estado del contrato y el del cobro van por separado (T-26): se enseñan
 * los dos. Si el módulo de cobros falla, la contratación se sigue viendo.
 */
export async function ResumenContrataciones({
  organizationId,
  soloLectura = false,
}: {
  organizationId: string;
  soloLectura?: boolean;
}) {
  const r = await listarContrataciones({ organizationId });
  if (!r.ok) return <BloqueNoDisponible nombre="Tus servicios" />;
  const visibles = r.datos.filter((c) => c.status !== "borrador" && c.status !== "cancelada");
  if (visibles.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay servicios contratados.</p>;
  }
  const cobros = await resumenCobros(visibles.map((c) => c.id));

  return (
    <ul className="flex flex-col gap-3">
      {visibles.map((c) => {
        const cobro = cobros.ok ? cobros.datos.get(c.id) : undefined;
        const paso = pasoCliente({
          status: c.status,
          requiresSignature: c.requires_signature,
          requiresPayment: c.requires_payment,
          cobro: cobro?.status ?? null,
        });
        return (
          <li key={c.id}>
            <Card className="flex flex-col gap-3 p-4 sm:p-5" data-testid="servicio-cliente">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{c.servicio}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge tone={ESTADOS[c.status].tono}>{ESTADOS[c.status].etiqueta}</Badge>
                  {cobro && (
                    <Badge tone={ESTADOS_COBRO[cobro.status].tono}>
                      {ESTADOS_COBRO[cobro.status].etiqueta}
                    </Badge>
                  )}
                </span>
              </div>
              {cobro && cobro.total_cents > 0 && (
                <p className="text-sm text-muted" data-testid="cobro-cliente">
                  Pagado {euros(cobro.paid_cents)} de {euros(cobro.total_cents)} (IVA incluido)
                  {cobro.balance_cents > 0 && cobro.status !== "pagado"
                    ? ` · pendiente ${euros(cobro.balance_cents)}`
                    : ""}
                </p>
              )}
              {paso && <p className="text-sm">{paso.texto}</p>}
              {paso?.accion && !soloLectura && (
                <Link
                  href={`/bienvenida/${c.id}`}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Continuar
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
