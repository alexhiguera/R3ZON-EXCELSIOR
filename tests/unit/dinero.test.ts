import { describe, expect, it } from "vitest";
import {
  aCentimos,
  aPorcentaje,
  centimosATexto,
  euros,
  MAX_CENTIMOS,
  porcentaje,
} from "@/lib/dinero";

/**
 * Dinero en la app: céntimos enteros, sin coma flotante. Los cálculos los hace
 * la base (tests/db/contrataciones-condiciones.test.ts); aquí, la traducción
 * entre texto y céntimos, que es lo que podría perder un céntimo.
 */

// El símbolo va tras un espacio duro (U+00A0), como en es-ES: se normaliza para comparar.
const plano = (s: string) => s.replace(/ /g, " ");

describe("euros: céntimos → texto", () => {
  it.each([
    [0, "0,00 €"],
    [5, "0,05 €"],
    [1050, "10,50 €"],
    [150000, "1.500,00 €"],
    [181500, "1.815,00 €"],
    ["1234567", "12.345,67 €"],
    [-1050, "-10,50 €"],
    [99999999999, "999.999.999,99 €"],
  ])("%s → %s", (centimos, texto) => expect(plano(euros(centimos))).toBe(texto));

  it("no pierde precisión con importes que un float no representa", () => {
    // 2^53 + 1 céntimos: como `number` se redondearía; como bigint, no.
    expect(plano(euros(9007199254740993n))).toBe("90.071.992.547.409,93 €");
  });
});

describe("aCentimos: texto en euros → céntimos, exacto", () => {
  it.each([
    ["1500", 150000],
    ["1.500", 150000],
    ["1500,5", 150050],
    ["1.500,50 €", 150050],
    ["10,50", 1050],
    ["0,05", 5],
    ["0,1", 10],
    ["0,29", 29], // 0.29 * 100 en coma flotante da 28,999999999999996
    ["1,13", 113], // 1.13 * 100 = 112,99999999999999
    ["333,33", 33333],
    ["12.345.678,90", 1234567890],
    ["1.000.000.000", 100000000000],
  ])("%s → %d", (texto, esperado) => expect(aCentimos(texto)).toBe(esperado));

  it.each(["", "abc", "-5", "1,505", "1.50", "1,2,3", "1e5", "0x10", "1.000.000.000,01", "NaN"])(
    "rechaza %j",
    (texto) => expect(aCentimos(texto)).toBeNull(),
  );

  it("el máximo es el de la base", () => {
    expect(MAX_CENTIMOS).toBe(100_000_000_000n);
  });

  it("ida y vuelta con centimosATexto", () => {
    for (const c of [0, 7, 150050, 33334, 99999999999]) {
      expect(aCentimos(centimosATexto(c))).toBe(c);
    }
    expect(centimosATexto("7")).toBe("0,07");
    expect(centimosATexto(-50)).toBe("-0,50");
  });
});

describe("porcentajes", () => {
  it.each([
    ["21", "21"],
    ["21 %", "21"],
    ["10,5", "10.5"],
    ["10.50", "10.50"],
    ["0", "0"],
    ["100", "100"],
    ["4,00", "4.00"],
  ])("%s → %s (texto exacto para la base)", (texto, esperado) =>
    expect(aPorcentaje(texto)).toBe(esperado),
  );

  it.each(["", "-1", "100,01", "101", "10,555", "1e1", "abc"])("rechaza %j", (texto) =>
    expect(aPorcentaje(texto)).toBeNull(),
  );

  it("formatea el porcentaje que manda la base", () => {
    expect(plano(porcentaje(21))).toBe("21 %");
    expect(plano(porcentaje("21.00"))).toBe("21 %");
    expect(plano(porcentaje("10.50"))).toBe("10,5 %");
    expect(plano(porcentaje(4))).toBe("4 %");
  });
});
