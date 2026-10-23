import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import { CIERRES_MANUALES, ESTADOS, etapaEmbudo, TRANSICIONES } from "@/modulos/contrataciones";
import { leerCondiciones } from "@/modulos/servicios";

const ENUM = Constants.public.Enums.engagement_status;

describe("estados de contratación", () => {
  it("cada estado de la base tiene etiqueta y transiciones en la interfaz", () => {
    expect(Object.keys(ESTADOS).sort()).toEqual([...ENUM].sort());
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ENUM].sort());
  });

  it("los cierres manuales son estados finales", () => {
    for (const e of CIERRES_MANUALES) expect(TRANSICIONES[e]).toEqual([]);
  });

  it.each([
    ["invitada", false, "invitado"],
    ["invitada", true, "cuenta"],
    ["datos_completos", true, "datos"],
    ["firmada", true, "firmado"],
    ["pago_en_curso", true, "pago"],
    ["en_impago", true, "pago"],
    ["pagada", true, "en_marcha"],
    ["activa", true, "en_marcha"],
    ["borrador", false, null],
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
