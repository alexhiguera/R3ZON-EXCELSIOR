import { describe, expect, it } from "vitest";
import { aCentimos, centimosATexto, euros } from "@/lib/formato";

// Intl usa espacios especiales (U+00A0 / U+202F): se normalizan para comparar.
const plano = (s: string) => s.replace(/[  ]/g, " ");

describe("euros", () => {
  it("formatea céntimos, también si llegan como texto (bigint de la base)", () => {
    expect(plano(euros(150000))).toBe("1500,00 €");
    expect(plano(euros("1234567"))).toBe("12.345,67 €");
    expect(plano(euros(5))).toBe("0,05 €");
  });
});

describe("aCentimos", () => {
  it.each([
    ["1500", 150000],
    ["1.500", 150000],
    ["1500,5", 150050],
    ["1.500,50 €", 150050],
    ["0,05", 5],
    ["12.345.678,90", 1234567890],
  ])("%s → %d", (texto, esperado) => expect(aCentimos(texto)).toBe(esperado));

  it.each(["", "abc", "-5", "1,505", "1.50", "1,2,3", "1e5"])("rechaza %j", (texto) =>
    expect(aCentimos(texto)).toBeNull(),
  );

  it("ida y vuelta con centimosATexto", () => {
    expect(aCentimos(centimosATexto(150050))).toBe(150050);
    expect(centimosATexto("7")).toBe("0,07");
  });
});
