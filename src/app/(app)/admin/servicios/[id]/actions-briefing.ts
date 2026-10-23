"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { anadirElementoPlantilla, quitarElementoPlantilla } from "@/modulos/proyectos/servidor";

/* Plantilla de briefing de un servicio. Solo admin: lo aplica la RLS. */

export async function accionAnadirBriefing(
  serviceId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anadirElementoPlantilla(serviceId, {
    seccion: String(datos.get("seccion") ?? ""),
    tipo: String(datos.get("tipo") ?? "") as "texto",
    etiqueta: String(datos.get("etiqueta") ?? ""),
    ayuda: String(datos.get("ayuda") ?? ""),
    obligatorio: datos.get("obligatorio") === "on",
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/servicios/${serviceId}`);
  return { error: null, ok: "Añadido al briefing." };
}

export async function accionQuitarBriefing(
  serviceId: string,
  elementoId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await quitarElementoPlantilla(elementoId);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/servicios/${serviceId}`);
  return { error: null, ok: "Quitado del briefing." };
}
