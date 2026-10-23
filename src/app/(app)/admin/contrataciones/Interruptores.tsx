import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";
import { ETIQUETA_PLAN, PLANES, type Plan } from "@/modulos/servicios";
/**
 * Los dos interruptores de una contratación (T-27): qué tiene que hacer el
 * cliente EN EL PORTAL. Desmarcados cubren a quien ya firmó o pagó fuera. Y la
 * modalidad de pago, que fija R3ZON (T-31). Los lee `leerInterruptores`
 * (casillas: sin marcar no se envían; un campo deshabilitado, tampoco).
 */
export function Interruptores({
  firma = true,
  pago = true,
  firmaBloqueada = false,
  modalidad = "",
  planes,
  modalidadBloqueada = false,
}: {
  firma?: boolean;
  pago?: boolean;
  /** La firma ya no se puede cambiar (contrato firmado o contratación cerrada). */
  firmaBloqueada?: boolean;
  modalidad?: Plan | "";
  /** Las que permite el servicio; sin ellas (servicio aún sin elegir), todas. */
  planes?: Plan[];
  /** La modalidad va al contrato: solo cambia en borrador o invitada. */
  modalidadBloqueada?: boolean;
}) {
  const opciones = planes ?? PLANES;
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
      <Field
        label="Modalidad de pago"
        hint={
          modalidadBloqueada
            ? "Ya no se puede cambiar: el cliente ha dado sus datos."
            : "Con señal + entrega, el portal pide la señal y el resto cuando marques la entrega."
        }
      >
        <Select name="modalidad" defaultValue={modalidad} disabled={modalidadBloqueada}>
          {!planes && <option value="">La primera que permita el servicio</option>}
          {opciones.map((p) => (
            <option key={p} value={p}>
              {ETIQUETA_PLAN[p]}
            </option>
          ))}
        </Select>
      </Field>
    </fieldset>
  );
}

export function leerInterruptores(datos: FormData): {
  pideFirma: boolean;
  pidePago: boolean;
  modalidad: string;
} {
  return {
    pideFirma: datos.get("pide_firma") === "on",
    pidePago: datos.get("pide_pago") === "on",
    modalidad: String(datos.get("modalidad") ?? ""),
  };
}
