import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { aCentimos } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Estado } from "./estados";

export type Contratacion = {
  id: string;
  organization_id: string;
  cliente: string;
  servicio: string;
  version: number;
  status: Estado;
  price_cents: number;
  conditions: string | null;
  created_at: string;
  status_changed_at: string;
  invitacion_aceptada: boolean;
};

const SELECT = `id, organization_id, status, price_cents, conditions, created_at, status_changed_at,
  organizations(name),
  service_versions(version, services(name)),
  invitations(accepted_at)`;

type Fila = {
  id: string;
  organization_id: string;
  status: Estado;
  price_cents: number;
  conditions: string | null;
  created_at: string;
  status_changed_at: string;
  organizations: { name: string } | null;
  service_versions: { version: number; services: { name: string } | null } | null;
  invitations: { accepted_at: string | null } | null;
};

function aContratacion(f: Fila): Contratacion {
  return {
    id: f.id,
    organization_id: f.organization_id,
    cliente: f.organizations?.name ?? "—",
    servicio: f.service_versions?.services?.name ?? "—",
    version: f.service_versions?.version ?? 0,
    status: f.status,
    price_cents: f.price_cents,
    conditions: f.conditions,
    created_at: f.created_at,
    status_changed_at: f.status_changed_at,
    invitacion_aceptada: Boolean(f.invitations?.accepted_at),
  };
}

/**
 * Contrataciones visibles para el usuario (la RLS decide: el staff, todas; un
 * cliente, las de sus empresas). Con `organizationId`, solo las de esa empresa.
 */
export async function listarContrataciones(
  filtro: { organizationId?: string } = {},
): Promise<Resultado<Contratacion[]>> {
  const supabase = await createClient();
  let consulta = supabase
    .from("engagements")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filtro.organizationId) consulta = consulta.eq("organization_id", filtro.organizationId);
  const r = await leer("contrataciones", "listar", consulta);
  return r.ok ? { ok: true, datos: (r.datos as unknown as Fila[]).map(aContratacion) } : r;
}

const invitacionSchema = z.object({
  email: z.email("Escribe un email válido.").transform((e) => e.trim().toLowerCase()),
  versionId: z.uuid("Elige un servicio."),
  precio: z.string().transform((t, ctx) => {
    if (!t.trim()) return null; // sin precio: el del catálogo
    const c = aCentimos(t);
    if (c === null) {
      ctx.addIssue({
        code: "custom",
        message: "Escribe el precio en euros, p. ej. 1.500 o 1500,50.",
      });
      return z.NEVER;
    }
    return c;
  }),
  condiciones: z.string().max(4000, "Las condiciones son demasiado largas."),
});

/**
 * Invita a una persona a contratar un servicio: contratación + invitación en
 * una transacción (función `invite_to_service`). Devuelve el token una vez.
 */
export async function invitarAServicio(
  organizationId: string,
  datos: { email: string; versionId: string; precio: string; condiciones: string },
): Promise<ResultadoAccion<string>> {
  const d = invitacionSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  return escribir(
    "contrataciones",
    "invitar",
    supabase.rpc("invite_to_service", {
      p_organization_id: organizationId,
      p_email: d.data.email,
      p_service_version_id: d.data.versionId,
      // `undefined` y no `null`: así la función usa su DEFAULT (precio del catálogo).
      p_price_cents: d.data.precio ?? undefined,
      p_conditions: d.data.condiciones,
    }),
    "No se ha podido crear la contratación.",
  );
}

export async function cambiarEstado(
  id: string,
  estado: Estado,
  motivo: string,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "cambiar_estado",
    supabase.rpc("change_engagement_status", {
      p_engagement_id: id,
      p_status: estado,
      p_reason: motivo.trim().slice(0, 500),
    }),
    "No se ha podido cambiar el estado.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export type DetalleContratacion = Contratacion & {
  organizacion: string;
  servicio_resumen: string | null;
  incluye: string[];
  vat_rate: number;
  payment_plans: ("pago_unico" | "senal_entrega")[];
  deposit_percent: number | null;
};

/** Una contratación con su servicio. La RLS decide quién la ve (su empresa o el staff). */
export async function contratacion(id: string): Promise<Resultado<DetalleContratacion | null>> {
  const supabase = await createClient();
  const r = await leer(
    "contrataciones",
    "detalle",
    supabase
      .from("engagements")
      .select(
        `id, organization_id, status, price_cents, conditions, created_at, status_changed_at,
         organizations(name),
         service_versions(version, vat_rate, payment_plans, deposit_percent, includes, services(name, summary)),
         invitations(accepted_at)`,
      )
      .eq("id", id)
      .limit(1),
  );
  if (!r.ok) return r;
  const f = r.datos[0] as unknown as
    | (Fila & {
        service_versions: {
          version: number;
          vat_rate: number;
          payment_plans: ("pago_unico" | "senal_entrega")[];
          deposit_percent: number | null;
          includes: string[];
          services: { name: string; summary: string | null } | null;
        } | null;
      })
    | undefined;
  if (!f) return { ok: true, datos: null };
  return {
    ok: true,
    datos: {
      ...aContratacion(f),
      organizacion: f.organizations?.name ?? "—",
      servicio_resumen: f.service_versions?.services?.summary ?? null,
      incluye: f.service_versions?.includes ?? [],
      vat_rate: Number(f.service_versions?.vat_rate ?? 0),
      payment_plans: f.service_versions?.payment_plans ?? [],
      deposit_percent: f.service_versions?.deposit_percent ?? null,
    },
  };
}

export type CambioEstado = {
  id: string;
  from_status: Estado | null;
  to_status: Estado;
  changed_at: string;
  reason: string | null;
};

export async function historial(engagementId: string): Promise<Resultado<CambioEstado[]>> {
  const supabase = await createClient();
  return leer(
    "contrataciones",
    "historial",
    supabase
      .from("engagement_status_history")
      .select("id, from_status, to_status, changed_at, reason")
      .eq("engagement_id", engagementId)
      .order("changed_at"),
  );
}

/** El cliente confirma sus datos (invitada → datos_completos). Las reglas, en la base. */
export async function confirmarDatos(engagementId: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "confirmar_datos",
    supabase.rpc("confirm_engagement_data", { p_engagement_id: engagementId }),
    "No se han podido confirmar los datos.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

const nuevoClienteSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre de la empresa.").max(200),
  email: z.email("Escribe un email válido.").transform((e) => e.trim().toLowerCase()),
  versionId: z.union([z.literal(""), z.uuid()]),
  precio: z.string(),
  condiciones: z.string().max(4000, "Las condiciones son demasiado largas."),
});

/** Alta de cliente e invitación (con o sin servicio) en una transacción. */
export async function crearClienteConInvitacion(datos: {
  nombre: string;
  email: string;
  versionId: string;
  precio: string;
  condiciones: string;
}): Promise<ResultadoAccion<{ organizationId: string; token: string }>> {
  const d = nuevoClienteSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  let precio: number | undefined;
  if (d.data.versionId && d.data.precio.trim()) {
    const c = aCentimos(d.data.precio);
    if (c === null)
      return { ok: false, error: "Escribe el precio en euros, p. ej. 1.500 o 1500,50." };
    precio = c;
  }
  const supabase = await createClient();
  const r = await escribir<{ organization_id: string; token: string }[]>(
    "contrataciones",
    "crear_cliente_con_invitacion",
    supabase.rpc("create_client_with_invitation", {
      p_name: d.data.nombre,
      p_email: d.data.email,
      p_service_version_id: d.data.versionId || undefined,
      p_price_cents: precio,
      p_conditions: d.data.condiciones,
    }),
    "No se ha podido crear el cliente.",
  );
  if (!r.ok) return r;
  const fila = r.datos[0];
  if (!fila) return { ok: false, error: "No se ha podido crear el cliente." };
  return { ok: true, datos: { organizationId: fila.organization_id, token: fila.token } };
}
