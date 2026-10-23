import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { logger } from "@/lib/logger";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { EstadoContrato } from "./estados";
import { huecosDesconocidos } from "./huecos";

/* ───────────────────────────── Catálogo (admin) ───────────────────────────── */

export type ElementoCatalogo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  archivado: boolean;
  version: number | null;
  versionId: string | null;
};

export type VersionTexto = { id: string; version: number; body: string; created_at: string };

const textoSchema = z
  .string()
  .trim()
  .min(1, "Escribe el texto.")
  .max(100000, "El texto es demasiado largo.")
  .superRefine((t, ctx) => {
    const malos = huecosDesconocidos(t);
    if (malos.length) {
      ctx.addIssue({ code: "custom", message: `Huecos desconocidos: ${malos.join(", ")}` });
    }
  });

type Tipo = "plantilla" | "clausula";
const TABLAS = {
  plantilla: {
    tabla: "contract_templates",
    versiones: "contract_template_versions",
    fk: "template_id",
    nombre: "name",
  },
  clausula: {
    tabla: "contract_clauses",
    versiones: "contract_clause_versions",
    fk: "clause_id",
    nombre: "title",
  },
} as const;

/** Plantillas o cláusulas con su versión vigente (la última). Staff, por RLS. */
export async function listarCatalogo(tipo: Tipo): Promise<Resultado<ElementoCatalogo[]>> {
  const t = TABLAS[tipo];
  const supabase = await createClient();
  const r = await leer(
    "contratos",
    `listar_${tipo}`,
    supabase
      .from(t.tabla)
      .select(`id, ${t.nombre}, description, archived_at, ${t.versiones}(id, version)`)
      .order(t.nombre),
  );
  if (!r.ok) return r;
  return {
    ok: true,
    datos: (r.datos as unknown as Record<string, unknown>[]).map((f) => {
      const versiones = (f[t.versiones] as { id: string; version: number }[]) ?? [];
      const ultima = versiones.reduce<{ id: string; version: number } | null>(
        (m, v) => (!m || v.version > m.version ? v : m),
        null,
      );
      return {
        id: f.id as string,
        nombre: f[t.nombre] as string,
        descripcion: (f.description as string | null) ?? null,
        archivado: Boolean(f.archived_at),
        version: ultima?.version ?? null,
        versionId: ultima?.id ?? null,
      };
    }),
  };
}

export async function elementoCatalogo(
  tipo: Tipo,
  id: string,
): Promise<Resultado<{ elemento: ElementoCatalogo; versiones: VersionTexto[] } | null>> {
  const lista = await listarCatalogo(tipo);
  if (!lista.ok) return lista;
  const elemento = lista.datos.find((e) => e.id === id);
  if (!elemento) return { ok: true, datos: null };
  const supabase = await createClient();
  const consulta =
    tipo === "plantilla"
      ? supabase
          .from("contract_template_versions")
          .select("id, version, body, created_at")
          .eq("template_id", id)
          .order("version", { ascending: false })
      : supabase
          .from("contract_clause_versions")
          .select("id, version, body, created_at")
          .eq("clause_id", id)
          .order("version", { ascending: false });
  const v = await leer("contratos", `versiones_${tipo}`, consulta);
  return v.ok ? { ok: true, datos: { elemento, versiones: v.datos as VersionTexto[] } } : v;
}

/** Crea una plantilla o cláusula con su primera versión (solo admin, por RLS). */
export async function crearElemento(
  tipo: Tipo,
  datos: { nombre: string; descripcion: string; texto: string },
): Promise<ResultadoAccion<{ id: string }>> {
  const nombre = z.string().trim().min(1, "Escribe el nombre.").max(200).safeParse(datos.nombre);
  if (!nombre.success) return { ok: false, error: nombre.error.issues[0]!.message };
  const texto = textoSchema.safeParse(datos.texto);
  if (!texto.success) return { ok: false, error: texto.error.issues[0]!.message };
  const t = TABLAS[tipo];
  const supabase = await createClient();
  const fila =
    tipo === "plantilla"
      ? { name: nombre.data, description: datos.descripcion.trim() || null }
      : { title: nombre.data, description: datos.descripcion.trim() || null };
  const r = await escribir<{ id: string }>(
    "contratos",
    `crear_${tipo}`,
    supabase
      .from(t.tabla)
      // La forma de la fila depende de `tipo` (name / title): TypeScript no
      // puede relacionar la unión de tablas con la de filas.
      .insert(fila as never)
      .select("id")
      .single(),
    "No se ha podido crear.",
  );
  if (!r.ok) return r;
  const v = await nuevaVersionTexto(tipo, r.datos.id, texto.data);
  return v.ok ? r : v;
}

export async function nuevaVersionTexto(
  tipo: Tipo,
  id: string,
  texto: string,
): Promise<ResultadoAccion<{ id: string }>> {
  const t = textoSchema.safeParse(texto);
  if (!t.success) return { ok: false, error: t.error.issues[0]!.message };
  const tabla = TABLAS[tipo];
  const supabase = await createClient();
  return escribir<{ id: string }>(
    "contratos",
    `version_${tipo}`,
    supabase
      .from(tabla.versiones)
      // La columna de la FK depende de `tipo` (template_id / clause_id).
      .insert({ [tabla.fk]: id, body: t.data } as never)
      .select("id")
      .single(),
    "No se ha podido guardar la versión.",
  );
}

export type DatosPrestador = { legal_name: string; tax_id: string; address: string; email: string };

export async function datosPrestador(): Promise<Resultado<DatosPrestador>> {
  const supabase = await createClient();
  return leer(
    "contratos",
    "datos_prestador",
    supabase.from("provider_profile").select("legal_name, tax_id, address, email").single(),
  );
}

export async function guardarDatosPrestador(datos: DatosPrestador): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contratos",
    "guardar_prestador",
    supabase.from("provider_profile").update(datos).eq("id", true).select("legal_name").single(),
    "No se han podido guardar los datos de R3ZON.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/* ───────────────────────────── Contrato de una contratación ───────────────────────────── */

export type Contrato = {
  id: string;
  status: EstadoContrato;
  template_version_id: string;
  plantilla: string;
  plantilla_version: number;
  delegated_email: string | null;
  sent_at: string | null;
  signed_at: string | null;
  text_sha256: string | null;
  clausulas: string[]; // ids de versión de cláusula activadas
  anexos: { id: string; title: string; body: string }[];
};

/** Contrato vivo (o el último) de una contratación. Null si no hay. RLS: el cliente no ve borradores. */
export async function contratoDe(engagementId: string): Promise<Resultado<Contrato | null>> {
  const supabase = await createClient();
  const r = await leer(
    "contratos",
    "contrato_de",
    supabase
      .from("contracts")
      .select(
        `id, status, template_version_id, delegated_email, sent_at, signed_at, text_sha256,
         contract_template_versions(version, contract_templates(name)),
         contract_clause_selections(clause_version_id),
         contract_annexes(id, title, body, position, created_at)`,
      )
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  if (!r.ok) return r;
  const f = r.datos[0] as unknown as
    | {
        id: string;
        status: EstadoContrato;
        template_version_id: string;
        delegated_email: string | null;
        sent_at: string | null;
        signed_at: string | null;
        text_sha256: string | null;
        contract_template_versions: {
          version: number;
          contract_templates: { name: string } | null;
        } | null;
        contract_clause_selections: { clause_version_id: string }[];
        contract_annexes: {
          id: string;
          title: string;
          body: string;
          position: number;
          created_at: string;
        }[];
      }
    | undefined;
  if (!f) return { ok: true, datos: null };
  return {
    ok: true,
    datos: {
      id: f.id,
      status: f.status,
      template_version_id: f.template_version_id,
      plantilla: f.contract_template_versions?.contract_templates?.name ?? "—",
      plantilla_version: f.contract_template_versions?.version ?? 0,
      delegated_email: f.delegated_email,
      sent_at: f.sent_at,
      signed_at: f.signed_at,
      text_sha256: f.text_sha256 ? hexDeBytea(f.text_sha256) : null,
      clausulas: f.contract_clause_selections.map((s) => s.clause_version_id),
      anexos: [...f.contract_annexes]
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
        .map(({ id, title, body }) => ({ id, title, body })),
    },
  };
}

/** PostgREST devuelve un bytea como «\x…». */
function hexDeBytea(valor: string): string {
  return valor.startsWith("\\x") ? valor.slice(2) : valor;
}

/** Texto del contrato tal como se firmaría, compuesto por la base. */
export async function textoContrato(contractId: string): Promise<Resultado<string>> {
  const supabase = await createClient();
  return leer("contratos", "texto", supabase.rpc("contract_render", { p_contract_id: contractId }));
}

export async function crearContrato(
  engagementId: string,
  templateVersionId: string,
): Promise<ResultadoAccion<{ id: string }>> {
  const supabase = await createClient();
  return escribir<{ id: string }>(
    "contratos",
    "crear",
    supabase
      .from("contracts")
      // `organization_id` lo pone el trigger a partir de la contratación (la app
      // no tiene permiso de escribirlo); los tipos generados no lo saben.
      .insert({ engagement_id: engagementId, template_version_id: templateVersionId } as never)
      .select("id")
      .single(),
    "No se ha podido crear el contrato.",
  );
}

/** Deja activadas exactamente estas cláusulas (en este orden). Solo en borrador (trigger). */
export async function guardarClausulas(
  contractId: string,
  clauseVersionIds: string[],
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const borrar = await escribir(
    "contratos",
    "quitar_clausulas",
    supabase.from("contract_clause_selections").delete().eq("contract_id", contractId),
    "No se han podido guardar las cláusulas.",
  );
  if (!borrar.ok) return borrar;
  if (clauseVersionIds.length === 0) return { ok: true, datos: null };
  const r = await escribir(
    "contratos",
    "poner_clausulas",
    supabase.from("contract_clause_selections").insert(
      clauseVersionIds.map((id, position) => ({
        contract_id: contractId,
        clause_version_id: id,
        position,
      })),
    ),
    "No se han podido guardar las cláusulas.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function anadirAnexo(
  contractId: string,
  datos: { titulo: string; texto: string; posicion: number },
): Promise<ResultadoAccion<null>> {
  const titulo = z
    .string()
    .trim()
    .min(1, "Escribe el título del anexo.")
    .max(200)
    .safeParse(datos.titulo);
  if (!titulo.success) return { ok: false, error: titulo.error.issues[0]!.message };
  const texto = textoSchema.safeParse(datos.texto);
  if (!texto.success) return { ok: false, error: texto.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir(
    "contratos",
    "anadir_anexo",
    supabase.from("contract_annexes").insert({
      contract_id: contractId,
      title: titulo.data,
      body: texto.data,
      position: datos.posicion,
    }),
    "No se ha podido añadir el anexo.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function quitarAnexo(anexoId: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contratos",
    "quitar_anexo",
    supabase.from("contract_annexes").delete().eq("id", anexoId),
    "No se ha podido quitar el anexo.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function cambiarEstadoContrato(
  contractId: string,
  estado: "enviado" | "borrador" | "anulado",
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contratos",
    `estado_${estado}`,
    supabase
      .from("contracts")
      .update({ status: estado })
      .eq("id", contractId)
      .select("id")
      .single(),
    "No se ha podido cambiar el estado del contrato.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/* ───────────────────────────── Firma (cliente) ───────────────────────────── */

/**
 * Envía un código de un solo uso al email del usuario actual (plantilla
 * `supabase/templates/codigo.html`; en local llega a Mailpit). No crea
 * usuarios: `shouldCreateUser: false`.
 */
export async function enviarCodigo(): Promise<ResultadoAccion<null>> {
  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: "Hace falta iniciar sesión." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    logger("modulo/contratos").warn("enviar_codigo_failed", {
      code: error.code,
      status: error.status,
    });
    return {
      ok: false,
      error:
        error.status === 429
          ? "Has pedido varios códigos seguidos. Espera un minuto."
          : "No hemos podido enviar el código. Vuelve a intentarlo.",
    };
  }
  return { ok: true, datos: null };
}

const firmaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Escribe el código de 6 cifras del email."),
  nombre: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  dni: z.string().trim().min(8, "Escribe tu DNI o NIE.").max(20),
  cargo: z.string().trim().min(2, "Escribe tu cargo en la empresa.").max(100),
  firma: z.string().startsWith("data:image/png;base64,", "Dibuja tu firma."),
  acepto: z.boolean().refine((v) => v, "Tienes que aceptar el contrato para firmarlo."),
});

/**
 * Firma: primero verifica el código (la sesión queda con `amr: otp`, que es lo
 * que la base exige), después llama a `sign_contract`. Todas las reglas están
 * en la base: esto solo traduce el formulario.
 */
export async function firmarConCodigo(
  contractId: string,
  datos: z.input<typeof firmaSchema>,
): Promise<ResultadoAccion<string>> {
  const d = firmaSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: "Hace falta iniciar sesión." };

  const supabase = await createClient();
  const v = await supabase.auth.verifyOtp({
    email: user.email,
    token: d.data.codigo,
    type: "email",
  });
  if (v.error) {
    logger("modulo/contratos").warn("verificar_codigo_failed", { code: v.error.code });
    return { ok: false, error: "El código no es correcto o ha caducado. Pide uno nuevo." };
  }
  return escribir<string>(
    "contratos",
    "firmar",
    supabase.rpc("sign_contract", {
      p_contract_id: contractId,
      p_signer_name: d.data.nombre,
      p_signer_tax_id: d.data.dni,
      p_signer_role: d.data.cargo,
      p_signature_png_base64: d.data.firma,
      p_accepted: d.data.acepto,
    }),
    "No se ha podido firmar el contrato.",
  );
}

export async function delegarFirma(
  contractId: string,
  email: string,
): Promise<ResultadoAccion<string>> {
  const e = z.email("Escribe un email válido.").safeParse(email.trim().toLowerCase());
  if (!e.success) return { ok: false, error: e.error.issues[0]!.message };
  const supabase = await createClient();
  return escribir<string>(
    "contratos",
    "delegar",
    supabase.rpc("delegate_contract_signature", { p_contract_id: contractId, p_email: e.data }),
    "No se ha podido enviar el contrato a firmar.",
  );
}

/* ───────────────────────────── Documento firmado ───────────────────────────── */

export type ContratoFirmado = {
  id: string;
  signed_text: string;
  text_sha256: string;
  signed_at: string;
  firma: {
    signer_name: string;
    signer_tax_id: string;
    signer_role: string;
    signer_email: string;
    signature_png: string; // hex
    signature_sha256: string;
    otp_verified_at: string;
    ip: string | null;
  };
};

export async function contratoFirmado(
  contractId: string,
): Promise<Resultado<ContratoFirmado | null>> {
  const supabase = await createClient();
  const r = await leer(
    "contratos",
    "firmado",
    supabase
      .from("contracts")
      .select(
        `id, signed_text, text_sha256, signed_at,
         contract_signatures(signer_name, signer_tax_id, signer_role, signer_email, signature_png,
                             signature_sha256, otp_verified_at, ip)`,
      )
      .eq("id", contractId)
      .in("status", ["firmado", "sustituido"])
      .limit(1),
  );
  if (!r.ok) return r;
  const f = r.datos[0] as unknown as
    | {
        id: string;
        signed_text: string;
        text_sha256: string;
        signed_at: string;
        contract_signatures: ContratoFirmado["firma"] | ContratoFirmado["firma"][] | null;
      }
    | undefined;
  const firma = Array.isArray(f?.contract_signatures)
    ? f.contract_signatures[0]
    : f?.contract_signatures;
  if (!f || !firma) return { ok: true, datos: null };
  return {
    ok: true,
    datos: {
      id: f.id,
      signed_text: f.signed_text,
      text_sha256: hexDeBytea(f.text_sha256),
      signed_at: f.signed_at,
      firma: {
        ...firma,
        signature_png: hexDeBytea(firma.signature_png),
        signature_sha256: hexDeBytea(firma.signature_sha256),
      },
    },
  };
}
