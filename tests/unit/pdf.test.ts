import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

// `server-only` impide importar el módulo fuera del servidor; en los tests,
// donde no hay navegador, se neutraliza.
vi.mock("server-only", () => ({}));
const { pdfContrato } = await import("@/modulos/contratos/servidor");

// PNG real de 1×1 píxel.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
).toString("hex");

const firmado = (texto: string, png = PNG_1X1) => ({
  id: "0193",
  signed_text: texto,
  text_sha256: "ab".repeat(32),
  signed_at: "2026-10-23T10:00:00Z",
  firma: {
    signer_name: "Ana García Núñez",
    signer_tax_id: "12345678Z",
    signer_role: "Administradora",
    signer_email: "ana@acme.test",
    signature_png: png,
    signature_sha256: "cd".repeat(32),
    otp_verified_at: "2026-10-23T09:58:00Z",
    ip: "203.0.113.7",
  },
});

describe("pdfContrato", () => {
  it("genera un PDF con el contrato y la hoja de evidencias, también con caracteres raros", async () => {
    const texto = [
      "# Contrato «Ñandú» — 1.500,00 €",
      "",
      "Cláusula con **negrita**, acentos (áéíóú, ü, ¿¡) y un emoji 🚀 que la fuente no tiene.",
      "",
      "## Objeto",
      "- Diseño",
      "1. Primero",
      "",
      Array.from(
        { length: 120 },
        (_, i) => `Párrafo largo número ${i} para forzar varias páginas.`,
      ).join(" "),
    ].join("\n");
    const bytes = await pdfContrato(firmado(texto), "0193ABCDEF01");
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3); // texto (2+) + evidencias
    expect(doc.getTitle()).toBe("Contrato 0193ABCDEF01");
  });

  it("una firma que no es un PNG válido no impide generar el documento", async () => {
    const bytes = await pdfContrato(firmado("Texto breve.", "00ff"), "REF");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
