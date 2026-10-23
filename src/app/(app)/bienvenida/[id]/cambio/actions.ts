"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoForm } from "@/components/ui/FormAccion";
import { aceptarRevision } from "@/modulos/contrataciones/servidor";

/* El cliente acepta un cambio. Quién puede y cuándo lo decide la base. */

export async function accionAceptarCambio(
  engagementId: string,
  revisionId: string,
  _: EstadoForm,
  _datos: FormData,
): Promise<EstadoForm> {
  const r = await aceptarRevision(revisionId);
  if (!r.ok) return { error: r.error };
  revalidatePath("/inicio");
  revalidatePath(`/bienvenida/${engagementId}`);
  // La página ya no tiene cambio pendiente: se vuelve a ella confirmando.
  redirect(`/bienvenida/${engagementId}/cambio?hecho=1`);
}
