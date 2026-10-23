"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { origenDeLaPeticion } from "@/lib/origen";
import { enlaceInvitacion } from "@/modulos/acceso";
import { crearInvitacion, revocarInvitacion } from "@/modulos/acceso/servidor";
import { crearClienteConInvitacion, invitarAServicio } from "@/modulos/contrataciones/servidor";
import { archivarCliente, crearCliente } from "@/modulos/organizaciones/servidor";

/*
 * Acciones del panel de clientes. Quién puede ejecutarlas NO se decide aquí:
 * lo decide la RLS (solo staff). Una Server Action es un endpoint público más;
 * por eso no hay ninguna comprobación de permisos en este fichero que la base
 * no vuelva a hacer.
 */

const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "");

export async function accionCrearCliente(_: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const r = await crearCliente(texto(datos, "nombre"));
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${r.datos.id}`);
}

/** Cliente nuevo e invitación (con o sin servicio) de una vez. */
export async function accionCrearConInvitacion(
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await crearClienteConInvitacion({
    nombre: texto(datos, "nombre"),
    email: texto(datos, "email"),
    versionId: texto(datos, "servicio"),
    precio: texto(datos, "precio"),
    condiciones: texto(datos, "condiciones"),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/clientes");
  return {
    error: null,
    ok: "Cliente creado e invitación lista. Válida 7 días.",
    enlace: enlaceInvitacion(await origenDeLaPeticion(), r.datos.token),
    ir: { href: `/admin/clientes/${r.datos.organizationId}`, label: "Ir a la ficha del cliente" },
  };
}

export async function accionArchivar(
  id: string,
  archivar: boolean,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await archivarCliente(id, archivar);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin/clientes");
  return { error: null, ok: archivar ? "Cliente archivado." : "Cliente reactivado." };
}

/**
 * Invitar a una persona. Con servicio: contratación + invitación
 * (`invite_to_service`). Sin servicio: solo la invitación, con el rol elegido.
 * El enlace se enseña UNA vez: la base solo guarda el hash del token.
 */
export async function accionInvitar(
  organizationId: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const email = texto(datos, "email");
  const versionId = texto(datos, "servicio");
  const r = versionId
    ? await invitarAServicio(organizationId, {
        email,
        versionId,
        precio: texto(datos, "precio"),
        condiciones: texto(datos, "condiciones"),
      })
    : await crearInvitacion(organizationId, email, texto(datos, "rol") || "owner");
  if (!r.ok) return { error: r.error };

  revalidatePath(`/admin/clientes/${organizationId}`);
  return {
    error: null,
    ok: `Invitación creada para ${email.trim().toLowerCase()}. Válida 7 días.`,
    enlace: enlaceInvitacion(await origenDeLaPeticion(), r.datos),
  };
}

export async function accionRevocar(
  organizationId: string,
  invitacionId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await revocarInvitacion(invitacionId);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/clientes/${organizationId}`);
  return { error: null, ok: "Invitación anulada." };
}
