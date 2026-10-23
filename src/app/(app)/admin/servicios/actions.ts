"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { leerCondiciones } from "@/modulos/servicios";
import { archivarServicio, crearServicio, nuevaVersion } from "@/modulos/servicios/servidor";

/* Solo admin: lo aplica la RLS (services_insert_admin…), no este fichero. */

export async function accionCrearServicio(_: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const condiciones = leerCondiciones(datos);
  if (!condiciones.ok) return { error: condiciones.error };
  const r = await crearServicio(
    { nombre: String(datos.get("nombre") ?? ""), resumen: String(datos.get("resumen") ?? "") },
    condiciones.datos,
  );
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/servicios");
  redirect(`/admin/servicios/${r.datos.id}`);
}

export async function accionNuevaVersion(
  serviceId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const condiciones = leerCondiciones(datos);
  if (!condiciones.ok) return { error: condiciones.error };
  const r = await nuevaVersion(serviceId, condiciones.datos);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/servicios/${serviceId}`);
  revalidatePath("/admin/servicios");
  return { error: null, ok: "Condiciones guardadas como versión nueva." };
}

export async function accionArchivarServicio(
  id: string,
  archivar: boolean,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await archivarServicio(id, archivar);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/servicios/${id}`);
  revalidatePath("/admin/servicios");
  return { error: null, ok: archivar ? "Servicio archivado." : "Servicio reactivado." };
}
