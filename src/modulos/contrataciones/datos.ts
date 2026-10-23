import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { aCentimos, aPorcentaje } from "@/lib/dinero";
import { createClient } from "@/lib/supabase/server";
import type { Estado, EstadoRevision } from "./estados";

/*
 * Contrataciones y sus condiciones económicas. Los importes (bases, IVA,
 * totales, hitos) los calcula y guarda la BASE; aquí solo se valida lo que
 * escribe el equipo y se traduce. Quién puede: la RLS (las condiciones, el
 * staff; el cliente solo las lee y acepta). Qué cambio vale: los triggers.
 *
 * Porcentajes (IVA, descuento) viajan como TEXTO exacto («21», «10.5»): la base
 * los guarda en numeric sin pasar por coma flotante.
 */

/** numeric de Postgres como texto exacto; PostgREST lo convierte. */
const numeric = (texto: string) => texto as unknown as number;

export type Contratacion = {
  id: string;
  organization_id: string;
  cliente: string;
  /** Nombres de los servicios de las condiciones vigentes. */
  titulo: string;
  total_cents: number;
  status: Estado;
  created_at: string;
  status_changed_at: string;
  invitacion_aceptada: boolean;
  /** Hay una invitación enlazada (aceptada o no). */
  invitada: boolean;
  requires_signature: boolean;
  requires_payment: boolean;
  payment_review: boolean;
  payment_review_note: string | null;
  released_milestones: number;
  /** Hay un cambio de condiciones propuesto (que este usuario puede ver). */
  cambio_propuesto: boolean;
};

const SELECT = `id, organization_id, status, created_at, status_changed_at, invitation_id,
  requires_signature, requires_payment, payment_review, payment_review_note, released_milestones,
  organizations(name),
  invitations(accepted_at),
  vigente:engagement_revisions!engagements_current_revision_fk(total_cents, engagement_lines(name, position)),
  revisiones:engagement_revisions!engagement_revisions_engagement_id_fkey(status)`;

type Fila = {
  id: string;
  organization_id: string;
  status: Estado;
  created_at: string;
  status_changed_at: string;
  invitation_id: string | null;
  requires_signature: boolean;
  requires_payment: boolean;
  payment_review: boolean;
  payment_review_note: string | null;
  released_milestones: number;
  organizations: { name: string } | null;
  invitations: { accepted_at: string | null } | null;
  vigente: { total_cents: number; engagement_lines: { name: string; position: number }[] } | null;
  revisiones: { status: EstadoRevision }[];
};

function aContratacion(f: Fila): Contratacion {
  const lineas = [...(f.vigente?.engagement_lines ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: f.id,
    organization_id: f.organization_id,
    cliente: f.organizations?.name ?? "—",
    titulo: lineas.map((l) => l.name).join(", ") || "Sin servicios todavía",
    total_cents: Number(f.vigente?.total_cents ?? 0),
    status: f.status,
    created_at: f.created_at,
    status_changed_at: f.status_changed_at,
    invitacion_aceptada: Boolean(f.invitations?.accepted_at),
    invitada: Boolean(f.invitation_id),
    requires_signature: f.requires_signature,
    requires_payment: f.requires_payment,
    payment_review: f.payment_review,
    payment_review_note: f.payment_review_note,
    released_milestones: f.released_milestones,
    cambio_propuesto: f.revisiones.some((r) => r.status === "propuesta"),
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

/* ───────────────────────────── Condiciones económicas ───────────────────────────── */

export type Linea = {
  id: string;
  position: number;
  category_id: string;
  categoria: string;
  service_version_id: string | null;
  name: string;
  description: string | null;
  unit_price_cents: number;
  discount_percent: number | null;
  discount_amount_cents: number | null;
  vat_rate: number;
  discount_cents: number;
  base_cents: number;
};

export type Hito = {
  id: string;
  position: number;
  label: string;
  fixed_cents: number | null;
  weight: number | null;
  amount_cents: number;
};

export type Impuesto = { rate: number; base_cents: number; vat_cents: number };

export type Revision = {
  id: string;
  number: number;
  status: EstadoRevision;
  conditions: string | null;
  reason: string | null;
  subtotal_cents: number;
  discount_cents: number;
  base_cents: number;
  vat_cents: number;
  total_cents: number;
  taxes: Impuesto[];
  milestones_valid: boolean;
  created_at: string;
  proposed_at: string | null;
  accepted_at: string | null;
  lineas: Linea[];
  hitos: Hito[];
};

const SELECT_REVISION = `id, number, status, conditions, reason, subtotal_cents, discount_cents, base_cents,
  vat_cents, total_cents, taxes, milestones_valid, created_at, proposed_at, accepted_at,
  engagement_lines(id, position, category_id, service_version_id, name, description, unit_price_cents,
    discount_percent, discount_amount_cents, vat_rate, discount_cents, base_cents, service_categories(name)),
  engagement_milestones(id, position, label, fixed_cents, weight, amount_cents)`;

type FilaRevision = Omit<Revision, "lineas" | "hitos"> & {
  engagement_lines: (Omit<Linea, "categoria"> & { service_categories: { name: string } | null })[];
  engagement_milestones: Hito[];
};

function aRevision(f: FilaRevision): Revision {
  const { engagement_lines, engagement_milestones, ...r } = f;
  return {
    ...r,
    lineas: engagement_lines
      .map(({ service_categories, ...l }) => ({ ...l, categoria: service_categories?.name ?? "—" }))
      .sort((a, b) => a.position - b.position),
    hitos: [...engagement_milestones].sort((a, b) => a.position - b.position),
  };
}

export type DetalleContratacion = Contratacion & {
  organizacion: string;
  /** Las condiciones vigentes (las que ve el cliente en su alta). */
  vigente: Revision;
  /** Un cambio en preparación o propuesto (el cliente solo ve el propuesto). */
  cambio: Revision | null;
  /** Revisiones anteriores (sustituidas o descartadas), de la más nueva a la más vieja. */
  anteriores: Revision[];
};

/** Una contratación con sus condiciones. La RLS decide quién la ve (su empresa o el staff). */
export async function contratacion(id: string): Promise<Resultado<DetalleContratacion | null>> {
  const supabase = await createClient();
  const [e, r] = await Promise.all([
    leer(
      "contrataciones",
      "detalle",
      supabase.from("engagements").select(`${SELECT}, current_revision_id`).eq("id", id).limit(1),
    ),
    leer(
      "contrataciones",
      "revisiones",
      supabase
        .from("engagement_revisions")
        .select(SELECT_REVISION)
        .eq("engagement_id", id)
        .order("number", { ascending: false }),
    ),
  ]);
  if (!e.ok) return e;
  if (!r.ok) return r;
  const f = (e.datos as unknown as (Fila & { current_revision_id: string })[])[0];
  if (!f) return { ok: true, datos: null };
  const revisiones = (r.datos as unknown as FilaRevision[]).map(aRevision);
  const vigente = revisiones.find((x) => x.id === f.current_revision_id);
  if (!vigente) return { ok: false };
  return {
    ok: true,
    datos: {
      ...aContratacion(f),
      organizacion: f.organizations?.name ?? "—",
      vigente,
      cambio:
        revisiones.find(
          (x) => x.id !== vigente.id && (x.status === "borrador" || x.status === "propuesta"),
        ) ?? null,
      anteriores: revisiones.filter((x) => x.status === "sustituida" || x.status === "descartada"),
    },
  };
}

const precioSchema = z.string().transform((t, ctx) => {
  const c = aCentimos(t);
  if (c === null) {
    ctx.addIssue({
      code: "custom",
      message: "Escribe el precio en euros, p. ej. 1.500 o 1500,50.",
    });
    return z.NEVER;
  }
  return c;
});

const ivaSchema = z.string().transform((t, ctx) => {
  const p = aPorcentaje(t);
  if (p === null) {
    ctx.addIssue({ code: "custom", message: "El IVA es un porcentaje entre 0 y 100." });
    return z.NEVER;
  }
  return p;
});

const lineaSchema = z
  .object({
    categoria: z.uuid("Elige el tipo de servicio."),
    nombre: z.string().trim().min(1, "Escribe el nombre del servicio.").max(200),
    descripcion: z
      .string()
      .trim()
      .max(4000, "La descripción es demasiado larga.")
      .transform((d) => d || null),
    precio: precioSchema,
    iva: ivaSchema,
    descuentoTipo: z.enum(["ninguno", "porcentaje", "importe"]),
    descuento: z.string(),
  })
  .transform((d, ctx) => {
    let discount_percent: string | null = null;
    let discount_amount_cents: number | null = null;
    if (d.descuentoTipo === "porcentaje") {
      discount_percent = aPorcentaje(d.descuento);
      if (discount_percent === null || !/[1-9]/.test(discount_percent)) {
        ctx.addIssue({
          code: "custom",
          message: "El descuento es un porcentaje entre 0,01 y 100.",
        });
        return z.NEVER;
      }
    } else if (d.descuentoTipo === "importe") {
      discount_amount_cents = aCentimos(d.descuento);
      if (!discount_amount_cents) {
        ctx.addIssue({ code: "custom", message: "Escribe el descuento en euros, p. ej. 150,00." });
        return z.NEVER;
      }
    }
    return {
      category_id: d.categoria,
      name: d.nombre,
      description: d.descripcion,
      unit_price_cents: d.precio,
      vat_rate: numeric(d.iva),
      discount_percent: discount_percent === null ? null : numeric(discount_percent),
      discount_amount_cents,
    };
  });

export type DatosLinea = z.input<typeof lineaSchema>;

/** Servicio a medida en unas condiciones en borrador. La base calcula base e IVA. */
export async function anadirLinea(
  revisionId: string,
  datos: DatosLinea,
): Promise<ResultadoAccion<null>> {
  const d = lineaSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "linea_anadir",
    supabase
      .from("engagement_lines")
      .insert({ revision_id: revisionId, ...d.data } as never)
      .select("id")
      .single(),
    "No se ha podido añadir el servicio.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Servicio copiado del catálogo (nombre, resumen, precio e IVA), con precio pactado opcional (céntimos). */
async function lineaCatalogo(
  revisionId: string,
  versionId: string,
  precio: number | null,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "linea_catalogo",
    supabase.rpc("add_catalog_line", {
      p_revision_id: revisionId,
      p_service_version_id: versionId,
      // `undefined` y no `null`: así la función usa su DEFAULT (precio del catálogo).
      p_price_cents: precio ?? undefined,
    }),
    "No se ha podido añadir el servicio.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Desde un formulario: servicio del catálogo y precio pactado opcional (en euros). */
export async function anadirLineaCatalogo(
  revisionId: string,
  datos: { versionId: string; precio: string },
): Promise<ResultadoAccion<null>> {
  const v = z.uuid("Elige un servicio.").safeParse(datos.versionId);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message };
  let precio: number | null = null;
  if (datos.precio.trim()) {
    const p = precioSchema.safeParse(datos.precio);
    if (!p.success) return { ok: false, error: p.error.issues[0]!.message };
    precio = p.data;
  }
  return lineaCatalogo(revisionId, v.data, precio);
}

export async function editarLinea(
  lineaId: string,
  datos: DatosLinea,
): Promise<ResultadoAccion<null>> {
  const d = lineaSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "linea_editar",
    supabase
      .from("engagement_lines")
      .update(d.data as never)
      .eq("id", lineaId)
      .select("id")
      .single(),
    "No se ha podido guardar el servicio.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function quitarLinea(lineaId: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "linea_quitar",
    supabase.from("engagement_lines").delete().eq("id", lineaId).select("id").single(),
    "No se ha podido quitar el servicio.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

const hitoSchema = z
  .object({
    etiqueta: z.string().trim().min(1, "Escribe qué es este pago (p. ej. «Al empezar»).").max(120),
    tipo: z.enum(["reparto", "fijo"]),
    valor: z.string(),
  })
  .transform((d, ctx) => {
    if (d.tipo === "fijo") {
      const c = aCentimos(d.valor);
      if (!c) {
        ctx.addIssue({
          code: "custom",
          message: "Escribe el importe del pago en euros (IVA incluido).",
        });
        return z.NEVER;
      }
      return { label: d.etiqueta, fixed_cents: c, weight: null };
    }
    const texto = d.valor.trim() || "1";
    // Entero de 1 a 5 cifras: se analiza el texto, no se convierte un decimal.
    const peso = /^\d{1,5}$/.test(texto) ? Number.parseInt(texto, 10) : 0;
    if (peso < 1 || peso > 10000) {
      ctx.addIssue({
        code: "custom",
        message: "La parte del reparto es un número entero entre 1 y 10000.",
      });
      return z.NEVER;
    }
    return { label: d.etiqueta, fixed_cents: null, weight: peso };
  });

/** Hito de pago: importe fijo o parte del reparto de lo que quede. La base calcula los importes. */
export async function anadirHito(
  revisionId: string,
  datos: z.input<typeof hitoSchema>,
): Promise<ResultadoAccion<null>> {
  const d = hitoSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "hito_anadir",
    supabase
      .from("engagement_milestones")
      .insert({ revision_id: revisionId, ...d.data } as never)
      .select("id")
      .single(),
    "No se ha podido añadir el pago.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function quitarHito(hitoId: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "hito_quitar",
    supabase.from("engagement_milestones").delete().eq("id", hitoId).select("id").single(),
    "No se ha podido quitar el pago.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/**
 * Sustituye los hitos por N pagos iguales. El reparto (céntimos que sobran al
 * final) lo hace la base: 1.000 € en 3 → 333,33 + 333,33 + 333,34. Con 1, sin
 * hitos: un único pago del total.
 */
export async function dividirEnPagos(
  revisionId: string,
  partes: number,
): Promise<ResultadoAccion<null>> {
  if (!Number.isInteger(partes) || partes < 1 || partes > 24) {
    return { ok: false, error: "Elige entre 1 y 24 pagos." };
  }
  const supabase = await createClient();
  const borrado = await escribir(
    "contrataciones",
    "hitos_vaciar",
    supabase.from("engagement_milestones").delete().eq("revision_id", revisionId),
    "No se han podido cambiar los pagos.",
  );
  if (!borrado.ok) return borrado;
  if (partes === 1) return { ok: true, datos: null };
  const r = await escribir(
    "contrataciones",
    "hitos_dividir",
    supabase.from("engagement_milestones").insert(
      Array.from({ length: partes }, (_, i) => ({
        revision_id: revisionId,
        label: `Pago ${i + 1} de ${partes}`,
        weight: 1,
      })) as never,
    ),
    "No se han podido cambiar los pagos.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Condiciones de pago acordadas y particulares (van al contrato). */
export async function guardarCondicionesTexto(
  revisionId: string,
  texto: string,
): Promise<ResultadoAccion<null>> {
  if (texto.length > 4000) return { ok: false, error: "Las condiciones son demasiado largas." };
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "condiciones_texto",
    supabase
      .from("engagement_revisions")
      .update({ conditions: texto.trim() || null })
      .eq("id", revisionId)
      .select("id")
      .single(),
    "No se han podido guardar las condiciones.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Cambio de condiciones aceptadas: revisión nueva, copia de la vigente. */
export async function crearRevision(
  engagementId: string,
  motivo: string,
): Promise<ResultadoAccion<null>> {
  const m = motivo.trim();
  if (!m) return { ok: false, error: "Escribe por qué cambian las condiciones." };
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "revision_crear",
    supabase
      .from("engagement_revisions")
      .insert({ engagement_id: engagementId, reason: m.slice(0, 500) } as never)
      .select("id")
      .single(),
    "No se ha podido crear el cambio.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Proponer al cliente, retirar la propuesta o descartar un cambio (las reglas, en la base). */
export async function cambiarEstadoRevision(
  revisionId: string,
  estado: "propuesta" | "borrador" | "descartada",
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "revision_estado",
    supabase
      .from("engagement_revisions")
      .update({ status: estado })
      .eq("id", revisionId)
      .select("id")
      .single(),
    "No se ha podido cambiar el estado de las condiciones.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** El cliente acepta un cambio propuesto (si hay contrato firmado, se acepta firmando). */
export async function aceptarRevision(revisionId: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "revision_aceptar",
    supabase.rpc("accept_engagement_revision", { p_revision_id: revisionId }),
    "No se han podido aceptar las condiciones.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/**
 * Libera el siguiente hito de pago. `actual` es el número que se vio en
 * pantalla: si otro ya lo liberó (doble clic, dos pestañas), no se libera dos
 * veces.
 */
export async function liberarHito(
  engagementId: string,
  actual: number,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "hito_liberar",
    supabase
      .from("engagements")
      .update({ released_milestones: actual + 1 })
      .eq("id", engagementId)
      .eq("released_milestones", actual)
      .select("id")
      .single(),
    "No se ha podido liberar el pago (¿ya estaba liberado?).",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/* ───────────────────────────── Alta e invitación ───────────────────────────── */

const precioOpcional = z.string().transform((t, ctx) => {
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
});

const invitacionSchema = z.object({
  email: z.email("Escribe un email válido.").transform((e) => e.trim().toLowerCase()),
  versionId: z.uuid("Elige un servicio."),
  precio: precioOpcional,
  condiciones: z.string().max(4000, "Las condiciones son demasiado largas."),
  pideFirma: z.boolean(),
  pidePago: z.boolean(),
});

/**
 * Invita a una persona a contratar UN servicio del catálogo: contratación +
 * línea + invitación en una transacción (`invite_to_service`). Para varios
 * servicios, crear la contratación sin invitar y añadirlos. Token una vez.
 */
export async function invitarAServicio(
  organizationId: string,
  datos: {
    email: string;
    versionId: string;
    precio: string;
    condiciones: string;
    pideFirma: boolean;
    pidePago: boolean;
  },
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
      p_price_cents: d.data.precio ?? undefined,
      p_conditions: d.data.condiciones,
      p_requires_signature: d.data.pideFirma,
      p_requires_payment: d.data.pidePago,
    }),
    "No se ha podido crear la contratación.",
  );
}

const borradorSchema = z.object({
  versionId: z.union([z.literal(""), z.uuid("Elige un servicio.")]),
  precio: precioOpcional,
  condiciones: z.string().max(4000, "Las condiciones son demasiado largas."),
  pideFirma: z.boolean(),
  pidePago: z.boolean(),
});

/**
 * Contratación en BORRADOR, sin invitar todavía: R3ZON añade servicios, precios,
 * hitos y cobros ya recibidos antes de mandar el enlace. Con `versionId`,
 * empieza con ese servicio del catálogo.
 */
export async function crearContratacion(
  organizationId: string,
  datos: z.input<typeof borradorSchema>,
): Promise<ResultadoAccion<{ id: string }>> {
  const d = borradorSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const e = await escribir<{ id: string }>(
    "contrataciones",
    "crear",
    supabase
      .from("engagements")
      .insert({
        organization_id: organizationId,
        requires_signature: d.data.pideFirma,
        requires_payment: d.data.pidePago,
      })
      .select("id")
      .single(),
    "No se ha podido crear la contratación.",
  );
  if (!e.ok) return e;
  // La revisión 1 la crea la base al insertar: se lee después.
  const rev = await supabase
    .from("engagements")
    .select("current_revision_id")
    .eq("id", e.datos.id)
    .single();
  const revisionId = rev.data?.current_revision_id;
  if (!revisionId) return e; // la contratación existe; las condiciones se completan en su página
  if (d.data.condiciones.trim()) await guardarCondicionesTexto(revisionId, d.data.condiciones);
  if (d.data.versionId) {
    const l = await lineaCatalogo(revisionId, d.data.versionId, d.data.precio);
    if (!l.ok) return l;
  }
  return e;
}

/** Invita (o reinvita: revoca el enlace anterior) a una contratación. Devuelve el token una vez. */
export async function invitarContratacion(
  engagementId: string,
  email: string,
): Promise<ResultadoAccion<string>> {
  const e = z.email("Escribe un email válido.").safeParse(email.trim().toLowerCase());
  if (!e.success) return { ok: false, error: e.error.issues[0]!.message };
  const supabase = await createClient();
  return escribir<string>(
    "contrataciones",
    "invitar_existente",
    supabase.rpc("invite_engagement", { p_engagement_id: engagementId, p_email: e.data }),
    "No se ha podido crear la invitación.",
  );
}

/** Interruptores: ¿el cliente firma en el portal? ¿paga en el portal? (las reglas, en la base). */
export async function cambiarInterruptores(
  engagementId: string,
  valores: { pideFirma: boolean; pidePago: boolean },
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "contrataciones",
    "interruptores",
    supabase
      .from("engagements")
      .update({ requires_signature: valores.pideFirma, requires_payment: valores.pidePago })
      .eq("id", engagementId)
      .select("id")
      .single(),
    "No se han podido guardar los cambios.",
  );
  return r.ok ? { ok: true, datos: null } : r;
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

/**
 * El cliente confirma sus datos (invitada → datos_completos) y con ello acepta
 * las condiciones que se le han mostrado. Las reglas, en la base.
 */
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
  precio: precioOpcional,
  condiciones: z.string().max(4000, "Las condiciones son demasiado largas."),
  pideFirma: z.boolean(),
  pidePago: z.boolean(),
});

/** Alta de cliente e invitación (con o sin servicio) en una transacción. */
export async function crearClienteConInvitacion(datos: {
  nombre: string;
  email: string;
  versionId: string;
  precio: string;
  condiciones: string;
  pideFirma: boolean;
  pidePago: boolean;
}): Promise<ResultadoAccion<{ organizationId: string; token: string }>> {
  const d = nuevoClienteSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const supabase = await createClient();
  const r = await escribir<{ organization_id: string; token: string }[]>(
    "contrataciones",
    "crear_cliente_con_invitacion",
    supabase.rpc("create_client_with_invitation", {
      p_name: d.data.nombre,
      p_email: d.data.email,
      p_service_version_id: d.data.versionId || undefined,
      p_price_cents: d.data.versionId ? (d.data.precio ?? undefined) : undefined,
      p_conditions: d.data.condiciones,
      p_requires_signature: d.data.pideFirma,
      p_requires_payment: d.data.pidePago,
    }),
    "No se ha podido crear el cliente.",
  );
  if (!r.ok) return r;
  const fila = r.datos[0];
  if (!fila) return { ok: false, error: "No se ha podido crear el cliente." };
  return { ok: true, datos: { organizationId: fila.organization_id, token: fila.token } };
}
