import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { centimosATexto } from "@/lib/formato";
import { ETIQUETA_PLAN, PLANES, type Plan } from "@/modulos/servicios";

/**
 * Campos de las condiciones comerciales de un servicio (los lee
 * `leerCondiciones`). Con `inicial`, parten de la versión vigente.
 */
export function CamposCondiciones({
  inicial,
}: {
  inicial?: {
    price_cents: number | null;
    vat_rate: number | null;
    payment_plans: Plan[] | null;
    deposit_percent: number | null;
    includes: string[] | null;
  };
}) {
  const planes = inicial?.payment_plans ?? ["pago_unico"];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Precio (€, sin IVA)">
          <Input
            name="precio"
            inputMode="decimal"
            required
            placeholder="1.500,00"
            defaultValue={inicial?.price_cents != null ? centimosATexto(inicial.price_cents) : ""}
          />
        </Field>
        <Field label="IVA (%)">
          <Input
            name="iva"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={inicial?.vat_rate ?? 21}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Modalidades de pago</legend>
        {PLANES.map((plan) => (
          <label key={plan} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="planes"
              value={plan}
              defaultChecked={planes.includes(plan)}
              className="size-4 accent-[rgb(var(--rgb-primary))]"
            />
            {ETIQUETA_PLAN[plan]}
          </label>
        ))}
      </fieldset>
      <Field
        label="Señal (%)"
        hint="Solo con «Señal + entrega»: porcentaje que se cobra al firmar."
      >
        <Input
          name="senal"
          type="number"
          min={1}
          max={99}
          step={1}
          defaultValue={inicial?.deposit_percent ?? ""}
        />
      </Field>
      <Field label="Qué incluye" hint="Una cosa por línea. Se enseña al cliente en su bienvenida.">
        <Textarea name="incluye" rows={4} defaultValue={inicial?.includes?.join("\n") ?? ""} />
      </Field>
    </>
  );
}
