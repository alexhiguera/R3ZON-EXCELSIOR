import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { centimosATexto } from "@/lib/formato";

/**
 * Precio por defecto, IVA y «qué incluye» de un servicio (los lee
 * `leerCondiciones`). Con `inicial`, parten de la versión vigente. Cada
 * contratación los copia y los puede ajustar (presupuestos a medida).
 */
export function CamposCondiciones({
  inicial,
}: {
  inicial?: {
    price_cents: number | null;
    vat_rate: number | null;
    includes: string[] | null;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Precio (€, sin IVA)" hint="Por defecto: cada contratación puede ajustarlo.">
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
            inputMode="decimal"
            required
            defaultValue={String(inicial?.vat_rate ?? 21).replace(".", ",")}
          />
        </Field>
      </div>
      <Field label="Qué incluye" hint="Una cosa por línea. Se enseña al cliente en su bienvenida.">
        <Textarea name="incluye" rows={4} defaultValue={inicial?.includes?.join("\n") ?? ""} />
      </Field>
    </>
  );
}
