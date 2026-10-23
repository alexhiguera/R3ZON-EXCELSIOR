import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { createClient } from "@/lib/supabase/server";

/**
 * Gestión de invitaciones desde el panel de R3ZON (solo staff, por RLS). El
 * token en claro solo existe en la respuesta de crear: la base guarda su hash.
 */

export const emailSchema = z
  .email("Escribe un email válido.")
  .transform((e) => e.trim().toLowerCase());
export const rolSchema = z.enum(["owner", "member", "billing"]);

export type InvitacionPendiente = {
  id: string;
  email: string;
  role: z.infer<typeof rolSchema>;
  created_at: string;
  expires_at: string;
};

/** Invitaciones abiertas (ni aceptadas ni revocadas) de una empresa, también las caducadas. */
export async function invitacionesAbiertas(
  organizationId: string,
): Promise<Resultado<InvitacionPendiente[]>> {
  const supabase = await createClient();
  return leer(
    "acceso",
    "invitaciones_abiertas",
    supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  );
}

/** Invita a una persona a una empresa, sin servicio. Devuelve el token una vez. */
export async function crearInvitacion(
  organizationId: string,
  email: string,
  rol: string,
): Promise<ResultadoAccion<string>> {
  const e = emailSchema.safeParse(email);
  if (!e.success) return { ok: false, error: e.error.issues[0]!.message };
  const r = rolSchema.safeParse(rol);
  if (!r.success) return { ok: false, error: "Elige un rol válido." };

  const supabase = await createClient();
  return escribir(
    "acceso",
    "crear_invitacion",
    supabase.rpc("create_invitation", {
      p_organization_id: organizationId,
      p_email: e.data,
      p_role: r.data,
    }),
    "No se ha podido crear la invitación.",
  );
}

export async function revocarInvitacion(id: string): Promise<ResultadoAccion<{ id: string }>> {
  const supabase = await createClient();
  return escribir(
    "acceso",
    "revocar_invitacion",
    supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single(),
    "No se ha podido anular la invitación.",
  );
}
