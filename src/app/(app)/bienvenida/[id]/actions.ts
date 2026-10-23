"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { origenDeLaPeticion } from "@/lib/origen";
import { enlaceInvitacion } from "@/modulos/acceso";
import { confirmarDatos } from "@/modulos/contrataciones/servidor";
import { delegarFirma, enviarCodigo, firmarConCodigo } from "@/modulos/contratos/servidor";
import { guardarDatosFiscales, leerDatosFiscales } from "@/modulos/organizaciones/servidor";

/*
 * Pasos del cliente en su alta. Quién puede cada cosa (rol en la empresa,
 * estado, código verificado) lo decide la base; aquí solo se traduce el
 * formulario y se elige a qué paso seguir.
 */

const ruta = (id: string) => `/bienvenida/${id}`;

export async function accionGuardarDatos(
  engagementId: string,
  organizationId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const fiscales = leerDatosFiscales(datos);
  if (!fiscales.ok) return { error: fiscales.error };
  const g = await guardarDatosFiscales(organizationId, fiscales.datos);
  if (!g.ok) return { error: g.error };
  const c = await confirmarDatos(engagementId);
  if (!c.ok) return { error: c.error };
  revalidatePath(ruta(engagementId));
  redirect(`${ruta(engagementId)}?paso=contrato`);
}

export async function accionEnviarCodigo(_: EstadoForm, _datos: FormData): Promise<EstadoForm> {
  const r = await enviarCodigo();
  if (!r.ok) return { error: r.error };
  return {
    error: null,
    ok: "Te hemos enviado un código de 6 cifras a tu email. Caduca en una hora.",
  };
}

export async function accionFirmar(
  engagementId: string,
  contractId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const campo = (k: string) => String(datos.get(k) ?? "");
  const r = await firmarConCodigo(contractId, {
    codigo: campo("codigo"),
    nombre: campo("nombre"),
    dni: campo("dni"),
    cargo: campo("cargo"),
    firma: campo("firma"),
    acepto: datos.get("acepto") === "on",
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  redirect(`${ruta(engagementId)}?paso=listo`);
}

export async function accionDelegar(
  engagementId: string,
  contractId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const email = String(datos.get("email") ?? "");
  const r = await delegarFirma(contractId, email);
  if (!r.ok) return { error: r.error };
  revalidatePath(ruta(engagementId));
  return {
    error: null,
    ok: `Listo. Envía este enlace a ${email.trim().toLowerCase()}: con él crea su cuenta y firma el contrato.`,
    enlace: enlaceInvitacion(await origenDeLaPeticion(), r.datos),
  };
}
