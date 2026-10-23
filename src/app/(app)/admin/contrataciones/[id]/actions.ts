"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import {
  anadirAnexo,
  cambiarEstadoContrato,
  crearContrato,
  guardarClausulas,
  quitarAnexo,
} from "@/modulos/contratos/servidor";

/*
 * Preparación del contrato de una contratación (staff, por RLS). Qué se puede
 * cambiar en cada estado lo deciden los triggers: aquí no se repite.
 */

const ruta = (engagementId: string) => `/admin/contrataciones/${engagementId}`;

export async function accionCrearContrato(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const version = String(datos.get("plantilla") ?? "");
  if (!version) return { error: "Elige una plantilla." };
  const r = await crearContrato(engagementId, version);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Contrato creado en borrador." };
}

export async function accionGuardarClausulas(
  engagementId: string,
  contractId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await guardarClausulas(contractId, datos.getAll("clausulas").map(String));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Cláusulas guardadas." };
}

export async function accionAnadirAnexo(
  engagementId: string,
  contractId: string,
  posicion: number,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anadirAnexo(contractId, {
    titulo: String(datos.get("titulo") ?? ""),
    texto: String(datos.get("texto") ?? ""),
    posicion,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Anexo añadido." };
}

export async function accionQuitarAnexo(
  engagementId: string,
  anexoId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await quitarAnexo(anexoId);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Anexo quitado." };
}

export async function accionEstadoContrato(
  engagementId: string,
  contractId: string,
  estado: "enviado" | "borrador" | "anulado",
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await cambiarEstadoContrato(contractId, estado);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  const mensajes = {
    enviado: "Contrato enviado: el cliente ya puede revisarlo y firmarlo.",
    borrador: "Contrato retirado: vuelve a estar en borrador.",
    anulado: "Contrato anulado.",
  };
  return { error: null, ok: mensajes[estado] };
}
