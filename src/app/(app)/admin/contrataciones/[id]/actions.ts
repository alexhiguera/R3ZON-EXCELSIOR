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
  anadirHito,
  anadirLinea,
  anadirLineaCatalogo,
  cambiarEstado,
  cambiarEstadoRevision,
  cambiarInterruptores,
  crearRevision,
  type DatosLinea,
  dividirEnPagos,
  editarLinea,
  guardarCondicionesTexto,
  invitarContratacion,
  liberarHito,
  quitarHito,
  quitarLinea,
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

/* ───────────────────────────── Condiciones económicas ───────────────────────────── */

/*
 * Solo se traduce el formulario: los importes los calcula la base, y quién
 * puede tocar qué (staff, revisión en borrador) lo deciden RLS y triggers.
 */

function leerLinea(datos: FormData): DatosLinea {
  const campo = (k: string) => String(datos.get(k) ?? "");
  return {
    categoria: campo("categoria"),
    nombre: campo("nombre"),
    descripcion: campo("descripcion"),
    precio: campo("precio"),
    iva: campo("iva"),
    descuentoTipo: (campo("descuento_tipo") || "ninguno") as DatosLinea["descuentoTipo"],
    descuento: campo("descuento"),
  };
}

function hecho(engagementId: string, mensaje: string): EstadoForm {
  revalidatePath(ruta(engagementId));
  return { error: null, ok: mensaje };
}

export async function accionAnadirLinea(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anadirLinea(revisionId, leerLinea(datos));
  return r.ok ? hecho(engagementId, "Servicio añadido.") : { error: r.error };
}

export async function accionAnadirLineaCatalogo(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anadirLineaCatalogo(revisionId, {
    versionId: String(datos.get("servicio") ?? ""),
    precio: String(datos.get("precio") ?? ""),
  });
  return r.ok ? hecho(engagementId, "Servicio añadido.") : { error: r.error };
}

export async function accionEditarLinea(
  engagementId: string,
  lineaId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await editarLinea(lineaId, leerLinea(datos));
  return r.ok ? hecho(engagementId, "Servicio guardado.") : { error: r.error };
}

export async function accionQuitarLinea(
  engagementId: string,
  lineaId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await quitarLinea(lineaId);
  return r.ok ? hecho(engagementId, "Servicio quitado.") : { error: r.error };
}

export async function accionAnadirHito(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await anadirHito(revisionId, {
    etiqueta: String(datos.get("etiqueta") ?? ""),
    tipo: (String(datos.get("tipo") ?? "") || "reparto") as "reparto" | "fijo",
    valor: String(datos.get("valor") ?? ""),
  });
  return r.ok ? hecho(engagementId, "Pago añadido.") : { error: r.error };
}

export async function accionQuitarHito(
  engagementId: string,
  hitoId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await quitarHito(hitoId);
  return r.ok ? hecho(engagementId, "Pago quitado.") : { error: r.error };
}

export async function accionDividirPagos(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const texto = String(datos.get("partes") ?? "").trim();
  const partes = /^\d{1,2}$/.test(texto) ? Number.parseInt(texto, 10) : 0;
  const r = await dividirEnPagos(revisionId, partes);
  return r.ok
    ? hecho(
        engagementId,
        partes === 1 ? "Un único pago del total." : `Dividido en ${partes} pagos.`,
      )
    : { error: r.error };
}

export async function accionCondicionesTexto(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await guardarCondicionesTexto(revisionId, String(datos.get("condiciones") ?? ""));
  return r.ok ? hecho(engagementId, "Condiciones guardadas.") : { error: r.error };
}

export async function accionCrearRevision(
  engagementId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await crearRevision(engagementId, String(datos.get("motivo") ?? ""));
  return r.ok
    ? hecho(engagementId, "Cambio en preparación: edítalo y propónselo al cliente.")
    : { error: r.error };
}

export async function accionEstadoRevision(
  engagementId: string,
  revisionId: string,
  estado: "propuesta" | "borrador" | "descartada",
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await cambiarEstadoRevision(revisionId, estado);
  const mensajes = {
    propuesta: "Cambio propuesto: el cliente lo verá en su área.",
    borrador: "Propuesta retirada: puedes editarla de nuevo.",
    descartada: "Cambio descartado.",
  };
  return r.ok ? hecho(engagementId, mensajes[estado]) : { error: r.error };
}

/* ───────────────────────────── Cobros ───────────────────────────── */

export async function accionLiberarHito(
  engagementId: string,
  actual: number,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await liberarHito(engagementId, actual);
  return r.ok
    ? hecho(engagementId, "Pago liberado: el portal ya se lo pide al cliente.")
    : { error: r.error };
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
