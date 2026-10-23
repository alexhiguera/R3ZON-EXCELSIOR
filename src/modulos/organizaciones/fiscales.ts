import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";
import { esNifValido, normalizarNif } from "./nif";

export type DatosFiscales = {
  entity_type: "empresa" | "autonomo";
  legal_name: string;
  tax_id: string;
  address: string;
  postal_code: string;
  city: string;
  province: string | null;
  country: string;
  billing_email: string | null;
};

/** Datos fiscales de una empresa (la RLS: sus miembros y el staff). Null si aún no hay. */
export async function datosFiscales(
  organizationId: string,
): Promise<Resultado<DatosFiscales | null>> {
  const supabase = await createClient();
  const r = await leer(
    "organizaciones",
    "datos_fiscales",
    supabase
      .from("organization_billing")
      .select(
        "entity_type, legal_name, tax_id, address, postal_code, city, province, country, billing_email",
      )
      .eq("organization_id", organizationId)
      .limit(1),
  );
  return r.ok ? { ok: true, datos: (r.datos[0] as DatosFiscales | undefined) ?? null } : r;
}

const esquema = z
  .object({
    entity_type: z.enum(["empresa", "autonomo"], "Indica si es una empresa o un autónomo."),
    legal_name: z.string().trim().min(1, "Escribe la razón social o tu nombre completo.").max(200),
    tax_id: z.string().transform(normalizarNif),
    address: z.string().trim().min(1, "Escribe la dirección fiscal.").max(300),
    postal_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9 -]{3,10}$/, "Escribe un código postal válido."),
    city: z.string().trim().min(1, "Escribe la población.").max(100),
    province: z
      .string()
      .trim()
      .max(100)
      .transform((v) => v || null),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "País en formato de dos letras (ES)."),
    billing_email: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase() || null)
      .pipe(z.email("Escribe un email de facturación válido.").nullable()),
  })
  .superRefine((d, ctx) => {
    if (d.country === "ES" && !esNifValido(d.tax_id, d.entity_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["tax_id"],
        message:
          d.entity_type === "autonomo"
            ? "El DNI o NIE no es válido: revisa las cifras y la letra."
            : "El CIF no es válido: revisa las cifras y el carácter de control.",
      });
    }
    if (d.country !== "ES" && !/^[A-Z0-9]{8,14}$/.test(d.tax_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["tax_id"],
        message: "Escribe un identificador fiscal válido.",
      });
    }
  });

export function leerDatosFiscales(
  form: FormData,
): { ok: true; datos: DatosFiscales } | { ok: false; error: string } {
  const campo = (k: string) => String(form.get(k) ?? "");
  const r = esquema.safeParse({
    entity_type: campo("entity_type"),
    legal_name: campo("legal_name"),
    tax_id: campo("tax_id"),
    address: campo("address"),
    postal_code: campo("postal_code"),
    city: campo("city"),
    province: campo("province"),
    country: campo("country") || "ES",
    billing_email: campo("billing_email"),
  });
  return r.success ? { ok: true, datos: r.data } : { ok: false, error: r.error.issues[0]!.message };
}

/**
 * Guarda (crea o actualiza) los datos fiscales. Quién puede: la RLS
 * (propietario, facturación, staff).
 *
 * Actualizar y, si no había fila, insertar; NO `upsert`: PostgREST lo traduce
 * en `ON CONFLICT DO UPDATE` de todas las columnas enviadas, incluida
 * `organization_id`, que no tiene permiso de UPDATE a propósito (lo cazó un E2E:
 * «permission denied» para el propio propietario).
 */
export async function guardarDatosFiscales(
  organizationId: string,
  datos: DatosFiscales,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const mensaje = "No se han podido guardar los datos fiscales.";
  const actualizado = await escribir<{ organization_id: string }[]>(
    "organizaciones",
    "actualizar_datos_fiscales",
    supabase
      .from("organization_billing")
      .update(datos)
      .eq("organization_id", organizationId)
      .select("organization_id"),
    mensaje,
  );
  if (!actualizado.ok) return actualizado;
  if (actualizado.datos.length > 0) return { ok: true, datos: null };

  const r = await escribir(
    "organizaciones",
    "crear_datos_fiscales",
    supabase.from("organization_billing").insert({ organization_id: organizationId, ...datos }),
    mensaje,
  );
  return r.ok ? { ok: true, datos: null } : r;
}
