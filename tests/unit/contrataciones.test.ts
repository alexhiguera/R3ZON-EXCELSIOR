import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import { ESTADOS_COBRO, METODOS_EXTERNOS } from "@/modulos/cobros";
import {
  CIERRES_MANUALES,
  ESTADOS,
  etapaEmbudo,
  pasoCliente,
  pasosAlta,
  puedeActivarse,
  TRANSICIONES,
} from "@/modulos/contrataciones";
import { leerCondiciones } from "@/modulos/servicios";

const ENUM = Constants.public.Enums.engagement_status;

describe("estados de contratación", () => {
  it("cada estado de la base tiene etiqueta y transiciones en la interfaz", () => {
    expect(Object.keys(ESTADOS).sort()).toEqual([...ENUM].sort());
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ENUM].sort());
  });

  it("cada estado de cobro de la base tiene etiqueta, y no hay efectivo", () => {
    expect(Object.keys(ESTADOS_COBRO).sort()).toEqual(
      [...Constants.public.Enums.collection_status].sort(),
    );
    expect(METODOS_EXTERNOS.map((m) => m.valor as string)).not.toContain("efectivo");
    expect(Constants.public.Enums.payment_method as readonly string[]).not.toContain("efectivo");
  });

  it("se activa firmada, o con los datos si no se firma en el portal", () => {
    expect(puedeActivarse("firmada", true)).toBe(true);
    expect(puedeActivarse("datos_completos", false)).toBe(true);
    expect(puedeActivarse("datos_completos", true)).toBe(false);
    expect(puedeActivarse("invitada", false)).toBe(false);
  });

  it("los cierres manuales son estados finales", () => {
    for (const e of CIERRES_MANUALES) expect(TRANSICIONES[e]).toEqual([]);
  });

  it.each([
    ["borrador", false, "preparando"],
    ["invitada", false, "invitado"],
    ["invitada", true, "cuenta"],
    ["datos_completos", true, "datos"],
    ["firmada", true, "firmado"],
    ["activa", true, "en_marcha"],
    ["cancelada", true, null],
    ["finalizada", true, null],
  ] as const)("%s (cuenta: %s) → etapa %s", (estado, aceptada, etapa) => {
    expect(etapaEmbudo(estado, aceptada)).toBe(etapa);
  });
});

function form(campos: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

describe("leerCondiciones", () => {
  it("convierte el formulario en condiciones de la base", () => {
    const r = leerCondiciones(
      form({
        precio: "1.500,50",
        iva: "21",
        planes: ["pago_unico", "senal_entrega"],
        senal: "40",
        incluye: " Diseño \nSEO\n\nDiseño",
      }),
    );
    expect(r).toEqual({
      ok: true,
      datos: {
        price_cents: 150050,
        vat_rate: 21,
        payment_plans: ["pago_unico", "senal_entrega"],
        deposit_percent: 40,
        includes: ["Diseño", "SEO"],
      },
    });
  });

  it("sin señal + entrega, la señal se ignora", () => {
    const r = leerCondiciones(
      form({ precio: "100", iva: "21", planes: "pago_unico", senal: "50", incluye: "" }),
    );
    expect(r.ok && r.datos.deposit_percent).toBeNull();
  });

  it.each([
    [{ precio: "abc", iva: "21", planes: "pago_unico", incluye: "" }, /precio/],
    [{ precio: "100", iva: "21", incluye: "" }, /modalidad/],
    [{ precio: "100", iva: "21", planes: "senal_entrega", senal: "", incluye: "" }, /señal/],
    [{ precio: "100", iva: "21", planes: "senal_entrega", senal: "100", incluye: "" }, /señal/],
    [{ precio: "100", iva: "150", planes: "pago_unico", incluye: "" }, /./],
  ])("rechaza %j", (campos, mensaje) => {
    const r = leerCondiciones(form(campos));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(mensaje);
  });
});

describe("pasos del alta (onboarding condicional)", () => {
  const base = { requiresSignature: true, requiresPayment: true, pagoPendiente: true };

  it("cliente nuevo sin pagar: bienvenida, datos, contrato, pago, listo", () => {
    const p = pasosAlta({ ...base, status: "invitada" });
    expect(p.pasos).toEqual(["bienvenida", "datos", "contrato", "pago", "listo"]);
    expect(p.maximo).toBe(1);
    expect(p.porDefecto).toBe(0);
  });

  it("con datos y firma pendiente, llega hasta el contrato", () => {
    const p = pasosAlta({ ...base, status: "datos_completos" });
    expect(p.pasos[p.maximo]).toBe("contrato");
    expect(p.pasos[p.porDefecto]).toBe("contrato");
  });

  it("firmado y sin pagar: entra en el pago, pero el pago no bloquea «listo»", () => {
    const p = pasosAlta({ ...base, status: "firmada" });
    expect(p.pasos[p.porDefecto]).toBe("pago");
    expect(p.pasos[p.maximo]).toBe("listo");
  });

  it("cliente que ya pagó y firmó fuera: sin contrato ni pago", () => {
    const p = pasosAlta({
      status: "datos_completos",
      requiresSignature: false,
      requiresPayment: false,
      pagoPendiente: false,
    });
    expect(p.pasos).toEqual(["bienvenida", "datos", "listo"]);
    expect(p.pasos[p.porDefecto]).toBe("listo");
  });

  it("pagado del todo (o en revisión): no entra en el pago", () => {
    const p = pasosAlta({ ...base, status: "firmada", pagoPendiente: false });
    expect(p.pasos[p.porDefecto]).toBe("listo");
  });
});

describe("siguiente paso del cliente", () => {
  it("en revisión no se le pide pagar", () => {
    expect(
      pasoCliente({
        status: "firmada",
        requiresSignature: true,
        requiresPayment: true,
        cobro: "pendiente_revision",
      }),
    ).toEqual({ texto: expect.stringMatching(/revisando/), accion: false });
  });

  it("pagado: nada que hacer", () => {
    expect(
      pasoCliente({
        status: "firmada",
        requiresSignature: true,
        requiresPayment: true,
        cobro: "pagado",
      })?.accion,
    ).toBe(false);
  });

  it("parcialmente pagado: puede continuar para pagar lo pendiente", () => {
    expect(
      pasoCliente({
        status: "firmada",
        requiresSignature: true,
        requiresPayment: true,
        cobro: "parcialmente_pagado",
      }),
    ).toEqual({ texto: "Tienes un pago pendiente.", accion: true });
  });
});
