"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { aplazar, aportar } from "@/modulos/proyectos/servidor";

/*
 * Briefing del cliente. Quién puede escribir (propietario y miembros, no
 * facturación) y qué cambio vale lo decide la base: aquí no se repite.
 */

const ruta = (proyectoId: string) => `/proyectos/${proyectoId}`;

export async function accionAportar(
  proyectoId: string,
  elementoId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await aportar(elementoId, String(datos.get("valor") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(proyectoId));
  return { error: null, ok: "Enviado a R3ZON." };
}

export async function accionAplazar(
  proyectoId: string,
  elementoId: string,
  estado: "mas_tarde" | "no_aplica",
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await aplazar(elementoId, estado);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(proyectoId));
  return {
    error: null,
    ok: estado === "mas_tarde" ? "Lo dejas para más tarde." : "Marcado como «no aplica».",
  };
}
