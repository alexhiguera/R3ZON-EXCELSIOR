import "server-only";
import type { Database } from "@/lib/database.types";
import { leer, type Resultado } from "@/lib/datos";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type Empresa = { id: string; name: string };
export type RolEmpresa = Database["public"]["Enums"]["org_role"];

/**
 * Empresas (no archivadas) a las que pertenece el usuario actual. Sin filtro
 * de usuario: la RLS solo devuelve las suyas (o todas, si es del equipo).
 */
export async function misEmpresas(): Promise<Resultado<Empresa[]>> {
  const supabase = await createClient();
  return leer(
    "organizaciones",
    "mis_empresas",
    supabase.from("organizations").select("id, name").is("archived_at", null).order("name"),
  );
}

export type FiltroClientes = { busqueda?: string; estado?: "activos" | "archivados" | "todos" };

export type ClienteResumen = {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  miembros: number;
};

/** Panel R3ZON: listado de clientes. Solo staff (la RLS devuelve todos). */
export async function listarClientes(
  filtro: FiltroClientes = {},
): Promise<Resultado<ClienteResumen[]>> {
  const supabase = await createClient();
  let consulta = supabase
    .from("organizations")
    .select("id, name, created_at, archived_at, organization_members(count)")
    .order("name")
    .limit(200);
  const estado = filtro.estado ?? "activos";
  if (estado === "activos") consulta = consulta.is("archived_at", null);
  if (estado === "archivados") consulta = consulta.not("archived_at", "is", null);
  const busqueda = filtro.busqueda?.trim();
  // Comodines de LIKE escapados: la búsqueda es literal.
  if (busqueda) consulta = consulta.ilike("name", `%${busqueda.replace(/[\\%_]/g, "\\$&")}%`);

  const r = await leer("organizaciones", "listar_clientes", consulta);
  if (!r.ok) return r;
  return {
    ok: true,
    datos: r.datos.map(({ organization_members, ...o }) => ({
      ...o,
      miembros: organization_members[0]?.count ?? 0,
    })),
  };
}

export type Cliente = { id: string; name: string; created_at: string; archived_at: string | null };

export async function cliente(id: string): Promise<Resultado<Cliente | null>> {
  const supabase = await createClient();
  const r = await leer(
    "organizaciones",
    "cliente",
    supabase
      .from("organizations")
      .select("id, name, created_at, archived_at")
      .eq("id", id)
      .limit(1),
  );
  return r.ok ? { ok: true, datos: r.datos[0] ?? null } : r;
}

export type Persona = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: RolEmpresa;
  joined_at: string;
};

/** Personas de la empresa con su email (solo staff: lo comprueba la base). */
export async function directorio(organizationId: string): Promise<Resultado<Persona[]>> {
  const supabase = await createClient();
  return leer(
    "organizaciones",
    "directorio",
    supabase.rpc("organization_directory", { p_organization_id: organizationId }),
  );
}

export type Actividad = {
  id: string;
  created_at: string;
  action: string;
  actor_id: string | null;
};

/** Últimas acciones registradas sobre una empresa (solo staff, por RLS). */
export async function actividad(organizationId: string): Promise<Resultado<Actividad[]>> {
  const supabase = await createClient();
  return leer(
    "organizaciones",
    "actividad",
    supabase
      .from("audit_log")
      .select("id, created_at, action, actor_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  );
}

/**
 * Rol del usuario actual en una empresa (null si no pertenece). No usa
 * `leer()`: aquí un null es una respuesta válida, no un fallo.
 */
export async function rolEnEmpresa(organizationId: string): Promise<Resultado<RolEmpresa | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_role_of", { p_organization_id: organizationId });
  if (error) {
    logger("modulo/organizaciones").error("rol_en_empresa_failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, datos: data ?? null };
}

/** Deja constancia de que el equipo abre la vista de cliente (solo staff). */
export async function registrarVistaCliente(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_client_view", { p_organization_id: organizationId });
  return !error;
}
