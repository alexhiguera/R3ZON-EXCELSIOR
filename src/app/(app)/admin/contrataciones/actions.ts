"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { CIERRES_MANUALES, type Estado } from "@/modulos/contrataciones";
import { cambiarEstado } from "@/modulos/contrataciones/servidor";

/**
 * Cerrar una contratación desde el panel (cancelar o rescindir), con motivo.
 * Qué transición es válida lo decide la base; aquí solo se limita a los cierres
 * que tienen botón, para no abrir por esta vía los pasos del cliente.
 */
export async function accionCerrar(
  id: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const estado = String(datos.get("estado") ?? "") as Estado;
  if (!CIERRES_MANUALES.includes(estado)) return { error: "Elige cómo cerrarla." };
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribe el motivo: queda en el historial." };

  const r = await cambiarEstado(id, estado, motivo);
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/contrataciones");
  return { error: null, ok: "Contratación cerrada." };
}
