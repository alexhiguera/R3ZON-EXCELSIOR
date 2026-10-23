import "server-only";
import { z } from "zod";
import { escribir, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";

export const nombreClienteSchema = z
  .string()
  .trim()
  .min(1, "Escribe el nombre de la empresa.")
  .max(200, "El nombre es demasiado largo.");

/** Alta manual de un cliente (staff, por RLS). Devuelve su id. */
export async function crearCliente(nombre: string): Promise<ResultadoAccion<{ id: string }>> {
  const parsed = nombreClienteSchema.safeParse(nombre);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  return escribir(
    "organizaciones",
    "crear_cliente",
    supabase.from("organizations").insert({ name: parsed.data }).select("id").single(),
    "No se ha podido crear el cliente.",
  );
}

/** Archivar (o reactivar) un cliente. Nunca se borra (docs/RGPD.md). */
export async function archivarCliente(
  id: string,
  archivar: boolean,
): Promise<ResultadoAccion<{ id: string }>> {
  const supabase = await createClient();
  return escribir(
    "organizaciones",
    archivar ? "archivar_cliente" : "reactivar_cliente",
    supabase
      .from("organizations")
      .update({ archived_at: archivar ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
      .single(),
    "No se ha podido cambiar el estado del cliente.",
  );
}
