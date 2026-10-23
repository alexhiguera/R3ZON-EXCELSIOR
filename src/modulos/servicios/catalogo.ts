import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";
import type { Condiciones } from "./condiciones";

export type Categoria = { id: string; name: string; archived_at: string | null };

/** Tipos de servicio (desarrollo web, IA…). Se amplían con filas: los cobros no dependen de ellos. */
export async function listarCategorias(
  opciones: { incluirArchivadas?: boolean } = {},
): Promise<Resultado<Categoria[]>> {
  const supabase = await createClient();
  let consulta = supabase
    .from("service_categories")
    .select("id, name, archived_at")
    .order("position")
    .order("name");
  if (!opciones.incluirArchivadas) consulta = consulta.is("archived_at", null);
  return leer("servicios", "categorias", consulta);
}

/** Nueva categoría (solo admin, por RLS), antes de «Otros servicios personalizados». */
export async function crearCategoria(nombre: string): Promise<ResultadoAccion<{ id: string }>> {
  const n = z.string().trim().min(1, "Escribe el nombre.").max(60).safeParse(nombre);
  if (!n.success) return { ok: false, error: n.error.issues[0]!.message };
  const supabase = await createClient();
  return escribir(
    "servicios",
    "crear_categoria",
    supabase
      .from("service_categories")
      .insert({ name: n.data, position: 900 })
      .select("id")
      .single(),
    "No se ha podido crear la categoría (¿ya existe?).",
  );
}

export type ServicioVigente = {
  id: string;
  name: string;
  summary: string | null;
  category_id: string | null;
  archived_at: string | null;
  version_id: string | null;
  version: number | null;
  price_cents: number | null;
  vat_rate: number | null;
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

export type VersionServicio = Omit<Condiciones, "vat_rate"> & {
  id: string;
  version: number;
  created_at: string;
  vat_rate: number;
};

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
        .select("id, version, created_at, price_cents, vat_rate, includes")
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
  categoria: z.uuid("Elige el tipo de servicio."),
});

/**
 * Crea un servicio con su primera versión (solo admin, por RLS). Dos
 * escrituras: si la segunda falla, el servicio queda sin versión y se ve así en
 * el catálogo, sin precio; se completa con «Nueva versión».
 */
export async function crearServicio(
  datos: { nombre: string; resumen: string; categoria: string },
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
      .insert({ name: d.data.nombre, summary: d.data.resumen, category_id: d.data.categoria })
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
      // vat_rate va como texto exacto: PostgREST lo convierte a numeric sin pasar por float.
      .insert({
        service_id: serviceId,
        ...condiciones,
        vat_rate: condiciones.vat_rate as unknown as number,
      })
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
