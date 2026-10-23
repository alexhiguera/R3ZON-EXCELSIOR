import { z } from "zod";
import { aCentimos, aPorcentaje } from "@/lib/dinero";

/**
 * Validación del precio por defecto de una versión de servicio. Es
 * EXPERIENCIA DE USUARIO: las mismas reglas están en la base (CHECK de
 * service_versions), que es quien manda. Pura: se prueba sin montar nada.
 *
 * El catálogo es una plantilla: cada contratación copia nombre, precio e IVA
 * en sus propias líneas y los ajusta. Las modalidades de pago no son del
 * catálogo: van en los hitos de cada contratación.
 */

export type Condiciones = {
  price_cents: number;
  /** Porcentaje como texto exacto («21», «10.5»): la base lo guarda en numeric. */
  vat_rate: string;
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
    iva: z.string().transform((t, ctx) => {
      const p = aPorcentaje(t);
      if (p === null) {
        ctx.addIssue({ code: "custom", message: "El IVA es un porcentaje entre 0 y 100." });
        return z.NEVER;
      }
      return p;
    }),
    incluye: z.string().max(5000, "La lista de lo que incluye es demasiado larga."),
  })
  .transform((d, ctx): Condiciones => {
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
    return { price_cents: d.precio, vat_rate: d.iva, includes };
  });

/** Lee las condiciones de un formulario. */
export function leerCondiciones(
  form: FormData,
): { ok: true; datos: Condiciones } | { ok: false; error: string } {
  const r = esquema.safeParse({
    precio: String(form.get("precio") ?? ""),
    iva: String(form.get("iva") ?? "21"),
    incluye: String(form.get("incluye") ?? ""),
  });
  return r.success ? { ok: true, datos: r.data } : { ok: false, error: r.error.issues[0]!.message };
}
