import { z } from "zod";
import { aCentimos } from "@/lib/formato";

/**
 * Validación de las condiciones comerciales de una versión de servicio. Es
 * EXPERIENCIA DE USUARIO: las mismas reglas están en la base (CHECK de
 * service_versions), que es quien manda. Pura: se prueba sin montar nada.
 */

export const PLANES = ["pago_unico", "senal_entrega"] as const;
export type Plan = (typeof PLANES)[number];

export const ETIQUETA_PLAN: Record<Plan, string> = {
  pago_unico: "Pago único",
  senal_entrega: "Señal + entrega",
};

export type Condiciones = {
  price_cents: number;
  vat_rate: number;
  payment_plans: Plan[];
  deposit_percent: number | null;
  includes: string[];
};

const esquema = z
  .object({
    precio: z.string().transform((t, ctx) => {
      const c = aCentimos(t);
      if (c === null) {
        ctx.addIssue({
          code: "custom",
          message: "Escribe el precio en euros, p. ej. 1.500 o 1500,50.",
        });
        return z.NEVER;
      }
      return c;
    }),
    iva: z.coerce.number("El IVA tiene que ser un número.").min(0).max(100),
    planes: z.array(z.enum(PLANES)).min(1, "Elige al menos una modalidad de pago."),
    senal: z.string().optional(),
    incluye: z.string().max(5000, "La lista de lo que incluye es demasiado larga."),
  })
  .transform((d, ctx): Condiciones => {
    const conSenal = d.planes.includes("senal_entrega");
    let deposit: number | null = null;
    if (conSenal) {
      deposit = Number(d.senal);
      if (!Number.isInteger(deposit) || deposit < 1 || deposit > 99) {
        ctx.addIssue({ code: "custom", message: "La señal es un porcentaje entero entre 1 y 99." });
        return z.NEVER;
      }
    }
    const includes = [
      ...new Set(
        d.incluye
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    ];
    if (includes.length > 50) {
      ctx.addIssue({ code: "custom", message: "Como mucho 50 líneas en «qué incluye»." });
      return z.NEVER;
    }
    return {
      price_cents: d.precio,
      vat_rate: d.iva,
      payment_plans: d.planes,
      deposit_percent: deposit,
      includes,
    };
  });

/** Lee las condiciones de un formulario. */
export function leerCondiciones(
  form: FormData,
): { ok: true; datos: Condiciones } | { ok: false; error: string } {
  const r = esquema.safeParse({
    precio: String(form.get("precio") ?? ""),
    iva: form.get("iva") ?? "21",
    planes: form.getAll("planes").map(String),
    senal: form.get("senal")?.toString(),
    incluye: String(form.get("incluye") ?? ""),
  });
  return r.success ? { ok: true, datos: r.data } : { ok: false, error: r.error.issues[0]!.message };
}
