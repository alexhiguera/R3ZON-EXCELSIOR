import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { euros, fecha } from "@/lib/formato";
import { ESTADOS_COBRO, ESTADOS_PAGO, ETIQUETA_METODO, METODOS_EXTERNOS } from "@/modulos/cobros";
import { pagos, resumenCobro } from "@/modulos/cobros/servidor";
import type { DetalleContratacion } from "@/modulos/contrataciones/servidor";
import {
  accionAnularCobro,
  accionFacturado,
  accionRegistrarCobro,
  accionRevision,
} from "./actions";

/**
 * Estado económico de una contratación (T-26): resumen, historial de cobros
 * (externos y online), registrar un cobro externo, anular con motivo, anotar
 * la factura de Antares y la revisión. Las reglas (no superar el total,
 * inmutable, sin efectivo) las aplica la base.
 */
export async function SeccionCobro({ e }: { e: DetalleContratacion }) {
  const [resumen, historial] = await Promise.all([resumenCobro(e.id), pagos(e.id)]);
  if (!resumen.ok || !historial.ok) return <BloqueNoDisponible nombre="El cobro" />;
  const c = resumen.datos;
  if (!c) return <BloqueNoDisponible nombre="El cobro" />;
  const hoy = new Date().toISOString().slice(0, 10);
  const cerrada = ["finalizada", "cancelada", "rescindida"].includes(e.status);

  return (
    <Card className="flex flex-col gap-5" data-testid="seccion-cobro">
      <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">
        Cobro <Badge tone={ESTADOS_COBRO[c.status].tono}>{ESTADOS_COBRO[c.status].etiqueta}</Badge>
        {!c.requires_payment && <Badge>No paga en el portal</Badge>}
      </h2>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Total (con IVA)</dt>
          <dd className="font-medium">{euros(c.total_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Cobrado</dt>
          <dd className="font-medium" data-testid="cobrado">
            {euros(c.paid_cents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">En curso</dt>
          <dd>{euros(c.pending_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pendiente</dt>
          <dd className="font-medium" data-testid="pendiente">
            {euros(c.balance_cents)}
          </dd>
        </div>
      </dl>
      {e.payment_review && (
        <p role="note" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
          En revisión: no se le pedirá ningún pago al cliente hasta cerrarla.
          {e.payment_review_note ? ` Nota: ${e.payment_review_note}` : ""}
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Movimientos</h3>
        {historial.datos.length === 0 ? (
          <p className="text-sm text-muted">Sin cobros registrados.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {historial.datos.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
                data-testid="movimiento"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{euros(p.amount_cents)}</strong>
                    <span className="text-muted">
                      {ETIQUETA_METODO[p.method]} · {fecha(p.paid_on)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone={ESTADOS_PAGO[p.status].tono}>
                      {ESTADOS_PAGO[p.status].etiqueta}
                    </Badge>
                    {p.invoice_reference && (
                      <Badge tone="brand">Factura {p.invoice_reference}</Badge>
                    )}
                  </span>
                </div>
                {p.receipt_reference && (
                  <p className="text-xs text-muted">Justificante: {p.receipt_reference}</p>
                )}
                {p.voided_reason && (
                  <p className="text-xs text-muted">Anulado: {p.voided_reason}</p>
                )}
                {p.status === "confirmado" && !p.invoice_reference && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                      Anotar factura o anular
                    </summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <FormAccion
                        accion={accionFacturado.bind(null, e.id, p.id)}
                        boton="Anotar factura"
                        variante="secondary"
                      >
                        <Field
                          label="Referencia en Antares"
                          hint="Factura TicketBAI ya emitida por este cobro."
                        >
                          <Input name="factura" required maxLength={100} />
                        </Field>
                      </FormAccion>
                      {p.method !== "stripe" && (
                        <FormAccion
                          accion={accionAnularCobro.bind(null, e.id, p.id)}
                          boton="Anular cobro"
                          variante="ghost"
                        >
                          <Field label="Motivo de la anulación">
                            <Input name="motivo" required maxLength={500} />
                          </Field>
                        </FormAccion>
                      )}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!cerrada && e.status !== "cancelada" && (
        <section aria-labelledby="registrar-cobro" className="flex flex-col gap-3">
          <h3 id="registrar-cobro" className="text-sm font-medium">
            Registrar un cobro recibido fuera del portal
          </h3>
          <FormAccion
            accion={accionRegistrarCobro.bind(null, e.id)}
            boton="Registrar cobro"
            variante="secondary"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Importe (€, IVA incluido)">
                <Input name="importe" inputMode="decimal" required placeholder="1.210,00" />
              </Field>
              <Field label="Fecha del cobro">
                <Input name="fecha" type="date" required max={hoy} defaultValue={hoy} />
              </Field>
              <Field label="Método">
                <Select name="metodo" defaultValue="transferencia">
                  {METODOS_EXTERNOS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Referencia o concepto" hint="Obligatoria con «otro método».">
                <Input name="referencia" maxLength={200} />
              </Field>
              <Field
                label="Justificante"
                hint="Dónde está el documento (el fichero, con la Fase 5)."
              >
                <Input name="justificante" maxLength={300} />
              </Field>
            </div>
          </FormAccion>
        </section>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
          {e.payment_review ? "Cerrar la revisión" : "Marcar como pendiente de revisión"}
        </summary>
        <FormAccion
          accion={accionRevision.bind(null, e.id, !e.payment_review)}
          boton={e.payment_review ? "Cerrar revisión" : "Marcar en revisión"}
          variante="ghost"
          className="mt-3"
        >
          {!e.payment_review && (
            <Field label="Qué hay que revisar" hint="Lo ve solo el equipo.">
              <Input name="nota" maxLength={500} />
            </Field>
          )}
        </FormAccion>
      </details>
    </Card>
  );
}
