import { describe, expect, it } from "vitest";
import { bloques, huecosDesconocidos } from "@/modulos/contratos";

describe("markdown de los contratos", () => {
  it("títulos, párrafos, listas y negrita", () => {
    const texto = [
      "# Contrato",
      "",
      "Entre **R3ZON** y el cliente,",
      "que acuerdan:",
      "",
      "## Objeto",
      "- Diseño",
      "- SEO",
      "1. Primero",
      "2. Segundo",
    ].join("\n");
    expect(bloques(texto)).toEqual([
      { tipo: "titulo", nivel: 1, tramos: [{ texto: "Contrato", negrita: false }] },
      {
        tipo: "parrafo",
        tramos: [
          { texto: "Entre ", negrita: false },
          { texto: "R3ZON", negrita: true },
          { texto: " y el cliente, que acuerdan:", negrita: false },
        ],
      },
      { tipo: "titulo", nivel: 2, tramos: [{ texto: "Objeto", negrita: false }] },
      {
        tipo: "lista",
        numerada: false,
        elementos: [[{ texto: "Diseño", negrita: false }], [{ texto: "SEO", negrita: false }]],
      },
      {
        tipo: "lista",
        numerada: true,
        elementos: [[{ texto: "Primero", negrita: false }], [{ texto: "Segundo", negrita: false }]],
      },
    ]);
  });

  it("el HTML no es formato: se queda como texto", () => {
    expect(bloques("<script>alert(1)</script>")).toEqual([
      { tipo: "parrafo", tramos: [{ texto: "<script>alert(1)</script>", negrita: false }] },
    ]);
  });

  it("un ** sin cerrar no rompe nada", () => {
    expect(bloques("precio **especial")[0]).toEqual({
      tipo: "parrafo",
      tramos: [{ texto: "precio **especial", negrita: false }],
    });
  });
});

describe("huecosDesconocidos", () => {
  it("detecta los que no existen, sin repetir y en orden", () => {
    expect(
      huecosDesconocidos("{{cliente.nif}} {{ cliente.inventado }} {{zz}} {{cliente.inventado}}"),
    ).toEqual(["cliente.inventado", "zz"]);
  });
});
