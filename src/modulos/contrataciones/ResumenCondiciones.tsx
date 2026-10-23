import { euros, porcentaje } from "@/lib/dinero";
import type { Revision } from "./datos";

/**
 * Condiciones económicas de una revisión, tal como las calculó la base:
 * servicios con su descuento y base, IVA por tipo, total, hitos y condiciones
 * de pago. Solo enseña: aquí no se suma ni se redondea nada. Lo usan la
 * bienvenida del cliente, la propuesta de cambio y el panel, así que todos ven
 * exactamente lo mismo.
 */
export function ResumenCondiciones({ r, compacto = false }: { r: Revision; compacto?: boolean }) {
  return (
    <div className="flex flex-col gap-4 text-sm" data-testid="resumen-condiciones">
      <ul className="flex flex-col gap-3">
        {r.lineas.map((l) => (
          <li
            key={l.id}
            className="flex flex-col gap-1 rounded-xl border border-border p-3"
            data-testid="linea"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <strong>{l.name}</strong> <span className="text-xs text-muted">{l.categoria}</span>
              </span>
              <span className="font-medium">{euros(l.base_cents)} + IVA</span>
            </div>
            {!compacto && l.description && (
              <p className="whitespace-pre-line text-muted">{l.description}</p>
            )}
            <p className="text-xs text-muted">
              Precio {euros(l.unit_price_cents)}
              {l.discount_cents > 0 &&
                ` · descuento ${euros(l.discount_cents)}${l.discount_percent != null ? ` (${porcentaje(l.discount_percent)})` : ""}`}{" "}
              · IVA {porcentaje(l.vat_rate)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="grid gap-1.5 rounded-xl border border-border p-4">
        {r.discount_cents > 0 && (
          <>
            <Fila nombre="Suma de precios" valor={euros(r.subtotal_cents)} />
            <Fila nombre="Descuentos" valor={`−${euros(r.discount_cents)}`} />
          </>
        )}
        <Fila nombre="Base imponible" valor={euros(r.base_cents)} />
        {r.taxes.map((t) => (
          <Fila
            key={t.rate}
            nombre={`IVA ${porcentaje(t.rate)}${r.taxes.length > 1 ? ` sobre ${euros(t.base_cents)}` : ""}`}
            valor={euros(t.vat_cents)}
          />
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="font-semibold" data-testid="total-condiciones">
            {euros(r.total_cents)}
          </dd>
        </div>
      </dl>

      <div>
        <h4 className="mb-1.5 font-medium">Cómo se paga</h4>
        {r.hitos.length === 0 ? (
          <p className="text-muted">Un único pago de {euros(r.total_cents)}.</p>
        ) : (
          <ol className="flex flex-col gap-1" data-testid="hitos">
            {r.hitos.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>{h.label}</span>
                <span>{euros(h.amount_cents)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {r.conditions && (
        <div>
          <h4 className="mb-1.5 font-medium">Condiciones acordadas</h4>
          <p className="whitespace-pre-line text-muted">{r.conditions}</p>
        </div>
      )}
    </div>
  );
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{nombre}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
