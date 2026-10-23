import "server-only";
import { z } from "zod";
import { escribir, leer, type Resultado, type ResultadoAccion } from "@/lib/datos";
import { aCentimos } from "@/lib/formato";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { EstadoCobro, EstadoPago, MetodoCobro } from "./estados";

/*
 * Cobros de cada contratación. Las reglas (no superar el total, inmutable salvo
 * anular o facturar, Stripe solo desde el servidor, sin efectivo) están en la
 * base; aquí solo se traduce. Quién puede: la RLS (registrar = staff).
 */

export type ResumenCobro = {
  engagement_id: string;
  requires_payment: boolean;
  payment_review: boolean;
  /** Hitos de pago ya liberados (el primero, siempre). */
  released_milestones: number;
  /** Total con IVA de las condiciones vigentes. */
  total_cents: number;
  /** Número de hitos de pago (0: un único pago del total). */
  milestones: number;
  /** Suma de los hitos liberados (el total si no hay hitos). */
  released_cents: number;
  paid_cents: number;
  pending_cents: number;
  balance_cents: number;
  status: EstadoCobro;
  /** Lo que se le puede pedir ahora en el portal (lo calcula la base). */
  due_now_cents: number;
};

/** Estado de cobro de varias contrataciones (las que la RLS deje ver). */
export async function resumenCobros(
  engagementIds: string[],
): Promise<Resultado<Map<string, ResumenCobro>>> {
  if (engagementIds.length === 0) return { ok: true, datos: new Map() };
  const supabase = await createClient();
  const r = await leer(
    "cobros",
    "resumen",
    supabase
      .from("engagement_collections")
      .select(
        "engagement_id, requires_payment, payment_review, released_milestones, total_cents, milestones, released_cents, paid_cents, pending_cents, balance_cents, status, due_now_cents",
      )
      .in("engagement_id", engagementIds),
  );
  if (!r.ok) return r;
  return {
    ok: true,
    datos: new Map((r.datos as ResumenCobro[]).map((c) => [c.engagement_id, c])),
  };
}

export async function resumenCobro(engagementId: string): Promise<Resultado<ResumenCobro | null>> {
  const r = await resumenCobros([engagementId]);
  return r.ok ? { ok: true, datos: r.datos.get(engagementId) ?? null } : r;
}

export type Pago = {
  id: string;
  amount_cents: number;
  method: MetodoCobro;
  status: EstadoPago;
  paid_on: string;
  reference: string | null;
  receipt_reference: string | null;
  invoice_reference: string | null;
  voided_reason: string | null;
  created_at: string;
};

/** Historial de cobros de una contratación (el cliente ve el suyo; el staff, todos). */
export async function pagos(engagementId: string): Promise<Resultado<Pago[]>> {
  const supabase = await createClient();
  return leer(
    "cobros",
    "pagos",
    supabase
      .from("payments")
      .select(
        "id, amount_cents, method, status, paid_on, reference, receipt_reference, invoice_reference, voided_reason, created_at",
      )
      .eq("engagement_id", engagementId)
      .order("paid_on")
      .order("created_at"),
  );
}

const pagoExternoSchema = z.object({
  importe: z.string().transform((t, ctx) => {
    const c = aCentimos(t);
    if (c === null || c <= 0) {
      ctx.addIssue({ code: "custom", message: "Escribe el importe cobrado en euros (con IVA)." });
      return z.NEVER;
    }
    return c;
  }),
  metodo: z.enum(["transferencia", "otro"], "Elige cómo se cobró."),
  fecha: z.iso.date("Escribe la fecha del cobro."),
  referencia: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  justificante: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
});

/** Registra un cobro recibido fuera del portal (transferencia u otro). Solo staff. */
export async function registrarPagoExterno(
  engagementId: string,
  datos: z.input<typeof pagoExternoSchema>,
): Promise<ResultadoAccion<null>> {
  const d = pagoExternoSchema.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  if (d.data.metodo === "otro" && !d.data.referencia) {
    return { ok: false, error: "Con «otro método», describe en la referencia cómo se cobró." };
  }
  const supabase = await createClient();
  const r = await escribir(
    "cobros",
    "registrar_externo",
    supabase.from("payments").insert({
      engagement_id: engagementId,
      amount_cents: d.data.importe,
      method: d.data.metodo,
      paid_on: d.data.fecha,
      reference: d.data.referencia,
      receipt_reference: d.data.justificante,
      // organization_id lo pone el trigger a partir de la contratación.
    } as never),
    "No se ha podido registrar el cobro.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

export async function anularPago(pagoId: string, motivo: string): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "cobros",
    "anular",
    supabase
      .from("payments")
      .update({ status: "anulado", voided_reason: motivo.trim().slice(0, 500) })
      .eq("id", pagoId)
      .select("id")
      .single(),
    "No se ha podido anular el cobro.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Deja constancia de que el cobro ya está facturado en Antares (no se volverá a facturar). */
export async function marcarFacturado(
  pagoId: string,
  referencia: string,
): Promise<ResultadoAccion<null>> {
  const ref = referencia.trim();
  if (!ref) return { ok: false, error: "Escribe la referencia de la factura en Antares." };
  const supabase = await createClient();
  const r = await escribir(
    "cobros",
    "facturar",
    supabase
      .from("payments")
      .update({ invoice_reference: ref.slice(0, 100) })
      .eq("id", pagoId)
      .select("id")
      .single(),
    "No se ha podido guardar la factura.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/** Abre o cierra la revisión de cobro (bloquea pedir pagos mientras está abierta). */
export async function marcarRevision(
  engagementId: string,
  revisar: boolean,
  nota: string,
): Promise<ResultadoAccion<null>> {
  const supabase = await createClient();
  const r = await escribir(
    "cobros",
    "revision",
    supabase
      .from("engagements")
      .update({
        payment_review: revisar,
        payment_review_note: revisar ? nota.trim().slice(0, 500) || null : null,
      })
      .eq("id", engagementId)
      .select("id")
      .single(),
    "No se ha podido cambiar la revisión.",
  );
  return r.ok ? { ok: true, datos: null } : r;
}

/**
 * Importe que se le puede pedir AHORA al cliente en el portal (0 si no paga en
 * el portal, si está en revisión o si ya está pagado). Lo calcula la base: el
 * navegador nunca decide cuánto se cobra.
 */
export async function importeExigible(engagementId: string): Promise<Resultado<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("amount_due_now", { p_engagement_id: engagementId });
  if (error) {
    logger("modulo/cobros").error("importe_exigible_failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, datos: Number(data ?? 0) };
}
