"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { type EstadoProyecto, TRANSICIONES_PROYECTO } from "@/modulos/proyectos";
import { cambiarEstadoProyecto, revisarElemento } from "@/modulos/proyectos/servidor";

/* Equipo (RLS). Qué transición y qué revisión valen: los triggers. */

const ruta = (proyectoId: string) => `/admin/proyectos/${proyectoId}`;

export async function accionRevisar(
  proyectoId: string,
  elementoId: string,
  decision: "validado" | "cambios",
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await revisarElemento(elementoId, decision, String(datos.get("nota") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(proyectoId));
  return { error: null, ok: decision === "validado" ? "Validado." : "Cambios pedidos al cliente." };
}

export async function accionEstadoProyecto(
  proyectoId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const estado = String(datos.get("estado") ?? "") as EstadoProyecto;
  if (!(estado in TRANSICIONES_PROYECTO)) return { error: "Elige un estado." };
  const r = await cambiarEstadoProyecto(proyectoId, estado);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(proyectoId));
  return { error: null, ok: "Estado cambiado." };
}
