import "server-only";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { euros } from "@/lib/formato";
import { listarContrataciones } from "./datos";
import { ESTADOS, type Estado } from "./estados";

/** Qué le toca hacer al cliente en cada estado (texto para él, no para el equipo). */
export const SIGUIENTE_PASO: Partial<Record<Estado, string>> = {
  invitada: "Completa los datos de tu empresa para preparar el contrato.",
  datos_completos: "Revisa y firma tu contrato.",
  firmada: "Contrato firmado. El siguiente paso es el pago.",
  pago_en_curso: "Estamos esperando la confirmación de tu pago.",
  en_impago: "Hay un pago pendiente. Escríbenos si necesitas ayuda.",
};

/**
 * Contrataciones de una empresa tal como las ve el CLIENTE. Lo usan su inicio
 * y la «vista de cliente» del equipo (T-22): como es el mismo componente, el
 * equipo ve exactamente lo mismo. Con `soloLectura`, sin enlaces de acción.
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
  return (
    <ul className="flex flex-col gap-3">
      {visibles.map((c) => {
        const paso = SIGUIENTE_PASO[c.status];
        return (
          <li key={c.id}>
            <Card className="flex flex-col gap-3 p-4 sm:p-5" data-testid="servicio-cliente">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{c.servicio}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {euros(c.price_cents)} + IVA
                  <Badge tone={ESTADOS[c.status].tono}>{ESTADOS[c.status].etiqueta}</Badge>
                </span>
              </div>
              {paso && <p className="text-sm text-muted">{paso}</p>}
              {paso && !soloLectura && (
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
