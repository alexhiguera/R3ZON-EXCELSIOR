import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";
import type { Condiciones, Plan } from "./condiciones";

export type ServicioVigente = {
  id: string;
  name: string;
  summary: string | null;
  archived_at: string | null;
  version_id: string | null;
  version: number | null;
  price_cents: number | null;
  vat_rate: number | null;
  payment_plans: Plan[] | null;
  deposit_percent: number | null;
  includes: string[] | null;
};

/** Catálogo con la versión vigente de cada servicio (staff, por RLS). */
export async function listarServicios(
  opciones: { incluirArchivados?: boolean } = {},
): Promise<Resultado<ServicioVigente[]>> {
  const supabase = await createClient();
  let consulta = supabase.from("services_current").select("*").order("name");
  if (!opciones.incluirArchivados) consulta = consulta.is("archived_at", null);
  const r = await leer("servicios", "listar", consulta);
  return r.ok ? { ok: true, datos: r.datos as ServicioVigente[] } : r;
}

export type VersionServicio = Condiciones & { id: string; version: number; created_at: string };

export async function servicio(
  id: string,
): Promise<Resultado<{ servicio: ServicioVigente; versiones: VersionServicio[] } | null>> {
  const supabase = await createClient();
  const [s, v] = await Promise.all([
    leer(
      "servicios",
      "servicio",
      supabase.from("services_current").select("*").eq("id", id).limit(1),
    ),
    leer(
      "servicios",
      "versiones",
      supabase
        .from("service_versions")
        .select(
          "id, version, created_at, price_cents, vat_rate, payment_plans, deposit_percent, includes",
        )
        .eq("service_id", id)
        .order("version", { ascending: false }),
    ),
  ]);
  if (!s.ok || !v.ok) return { ok: false };
  const actual = s.datos[0] as ServicioVigente | undefined;
  return {
    ok: true,
    datos: actual ? { servicio: actual, versiones: v.datos as VersionServicio[] } : null,
  };
}

export const datosServicioSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del servicio.").max(120),
  resumen: z
    .string()
    .trim()
    .max(500, "El resumen es demasiado largo.")
    .transform((r) => r || null),
});

/**
 * Crea un servicio con su primera versión (solo admin, por RLS). Dos
 * escrituras: si la segunda falla, el servicio queda sin versión y se ve así en
 * el catálogo, sin precio; se completa con «Nueva versión».
 */
export async function crearServicio(
  datos: { nombre: string; resumen: string },
  condiciones: Condiciones,
): Promise<ResultadoAccion<{ id: string }>> {
  const d = datosServicioSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const s = await escribir<{ id: string }>(
    "servicios",
    "crear",
    supabase
      .from("services")
      .insert({ name: d.data.nombre, summary: d.data.resumen })
      .select("id")
      .single(),
    "No se ha podido crear el servicio.",
  );
  if (!s.ok) return s;
  const v = await nuevaVersion(s.datos.id, condiciones);
  return v.ok ? s : v;
}

/** Condiciones nuevas para un servicio: la versión anterior no se toca. */
export async function nuevaVersion(
  serviceId: string,
  condiciones: Condiciones,
): Promise<ResultadoAccion<{ id: string }>> {
  const supabase = await createClient();
  return escribir(
    "servicios",
    "nueva_version",
    supabase
      .from("service_versions")
      .insert({ service_id: serviceId, ...condiciones })
      .select("id")
      .single(),
    "No se han podido guardar las condiciones.",
  );
}

export async function archivarServicio(
  id: string,
  archivar: boolean,
): Promise<ResultadoAccion<{ id: string }>> {
  const supabase = await createClient();
  return escribir(
    "servicios",
    archivar ? "archivar" : "reactivar",
    supabase
      .from("services")
      .update({ archived_at: archivar ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
      .single(),
    "No se ha podido cambiar el estado del servicio.",
  );
}
