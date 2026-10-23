"use server";

import { revalidatePath } from "next/cache";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { origenDeLaPeticion } from "@/lib/origen";
import { enlaceInvitacion } from "@/modulos/acceso";
import {
  anularPago,
  marcarFacturado,
  marcarRevision,
  registrarPagoExterno,
} from "@/modulos/cobros/servidor";
import {
  cambiarEstado,
  cambiarInterruptores,
  invitarContratacion,
  marcarEntrega,
} from "@/modulos/contrataciones/servidor";
import {
  anadirAnexo,
  cambiarEstadoContrato,
  crearContrato,
  guardarClausulas,
  quitarAnexo,
} from "@/modulos/contratos/servidor";
import { leerInterruptores } from "../Interruptores";

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

/* ───────────────────────────── Alta, interruptores y activación ───────────────────────────── */

export async function accionInvitarContratacion(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const email = String(datos.get("email") ?? "");
  const r = await invitarContratacion(engagementId, email);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return {
    error: null,
    ok: `Invitación lista para ${email.trim().toLowerCase()}. Válida 7 días; la anterior, si había, queda anulada.`,
    enlace: enlaceInvitacion(await origenDeLaPeticion(), r.datos),
  };
}

export async function accionInterruptores(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await cambiarInterruptores(engagementId, leerInterruptores(datos));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Guardado." };
}

export async function accionActivar(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const motivo = String(datos.get("motivo") ?? "").trim() || "Puesta en marcha";
  const r = await cambiarEstado(engagementId, "activa", motivo);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Contratación activa: el proyecto está en marcha." };
}

/* ───────────────────────────── Cobros ───────────────────────────── */

export async function accionEntrega(
  engagementId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await marcarEntrega(engagementId);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Entrega marcada: el portal ya pide el resto." };
}

export async function accionRegistrarCobro(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const campo = (k: string) => String(datos.get(k) ?? "");
  const r = await registrarPagoExterno(engagementId, {
    importe: campo("importe"),
    metodo: campo("metodo") as "transferencia" | "otro",
    fecha: campo("fecha"),
    referencia: campo("referencia"),
    justificante: campo("justificante"),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Cobro registrado." };
}

export async function accionAnularCobro(
  engagementId: string,
  pagoId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anularPago(pagoId, String(datos.get("motivo") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Cobro anulado." };
}

export async function accionFacturado(
  engagementId: string,
  pagoId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await marcarFacturado(pagoId, String(datos.get("factura") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return { error: null, ok: "Factura anotada." };
}

export async function accionRevision(
  engagementId: string,
  revisar: boolean,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await marcarRevision(engagementId, revisar, String(datos.get("nota") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return {
    error: null,
    ok: revisar ? "Marcada como pendiente de revisión." : "Revisión cerrada.",
  };
}
