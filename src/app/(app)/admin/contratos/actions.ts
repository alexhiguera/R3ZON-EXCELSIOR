"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/components/ui/FormAccion";
import {
  crearElemento,
  guardarDatosPrestador,
  nuevaVersionTexto,
} from "@/modulos/contratos/servidor";

/* Solo admin: lo aplica la RLS. Los huecos los vuelve a comprobar la base. */

const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "");
const RUTA = { plantilla: "plantillas", clausula: "clausulas" } as const;

export async function accionCrear(
  tipo: "plantilla" | "clausula",
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await crearElemento(tipo, {
    nombre: texto(datos, "nombre"),
    descripcion: texto(datos, "descripcion"),
    texto: texto(datos, "texto"),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/contratos");
  redirect(`/admin/contratos/${RUTA[tipo]}/${r.datos.id}`);
}

export async function accionNuevaVersion(
  tipo: "plantilla" | "clausula",
  id: string,
  _: EstadoForm,
  datos: FormData,
): Promise<EstadoForm> {
  const r = await nuevaVersionTexto(tipo, id, texto(datos, "texto"));
  if (!r.ok) return { error: r.error };
  revalidatePath(`/admin/contratos/${RUTA[tipo]}/${id}`);
  revalidatePath("/admin/contratos");
  return {
    error: null,
    ok: "Guardado como versión nueva. Los contratos ya creados conservan la suya.",
  };
}

export async function accionGuardarPrestador(_: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const r = await guardarDatosPrestador({
    legal_name: texto(datos, "legal_name").trim(),
    tax_id: texto(datos, "tax_id").trim().toUpperCase(),
    address: texto(datos, "address").trim(),
    email: texto(datos, "email").trim().toLowerCase(),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/contratos");
  return { error: null, ok: "Datos de R3ZON guardados." };
}
