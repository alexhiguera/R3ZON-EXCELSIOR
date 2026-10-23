/**
 * Los dos interruptores de una contratación (T-27): qué tiene que hacer el
 * cliente EN EL PORTAL. Desmarcados cubren a quien ya firmó o pagó fuera.
 * Los lee `leerInterruptores` (casillas: sin marcar no se envían).
 */
export function Interruptores({
  firma = true,
  pago = true,
  firmaBloqueada = false,
}: {
  firma?: boolean;
  pago?: boolean;
  /** La firma ya no se puede cambiar (contrato firmado o contratación cerrada). */
  firmaBloqueada?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium">Qué hace el cliente en el portal</legend>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="pide_firma"
          defaultChecked={firma}
          disabled={firmaBloqueada}
          className="mt-0.5 size-4 accent-[rgb(var(--rgb-primary))]"
        />
        <span>
          Firma el contrato en el portal
          <span className="block text-xs text-muted">
            Desmárcalo si ya lo firmó fuera (en papel o por otra vía).
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="pide_pago"
          defaultChecked={pago}
          className="mt-0.5 size-4 accent-[rgb(var(--rgb-primary))]"
        />
        <span>
          Paga en el portal
          <span className="block text-xs text-muted">
            Desmárcalo si paga o ya pagó fuera; registra esos cobros en la contratación.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

export function leerInterruptores(datos: FormData): { pideFirma: boolean; pidePago: boolean } {
  return { pideFirma: datos.get("pide_firma") === "on", pidePago: datos.get("pide_pago") === "on" };
}
