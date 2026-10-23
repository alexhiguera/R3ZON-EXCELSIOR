import { describe, expect, it } from "vitest";
import { esCifValido, esDniONieValido, esNifValido, normalizarNif } from "@/modulos/organizaciones";

describe("NIF, NIE y CIF", () => {
  it("normaliza espacios, puntos, guiones y minúsculas", () => {
    expect(normalizarNif(" 12.345.678-z ")).toBe("12345678Z");
  });

  it.each(["12345678Z", "00000000T", "X1234567L", "Y1234567X", "Z1234567R"])(
    "DNI/NIE válido: %s",
    (v) => expect(esDniONieValido(v)).toBe(true),
  );

  it.each(["12345678A", "1234567Z", "X12345678L", "W1234567L", ""])("DNI/NIE no válido: %s", (v) =>
    expect(esDniONieValido(v)).toBe(false),
  );

  it.each(["B12345674", "A58818501", "Q2826000H", "P0800000B"])("CIF válido: %s", (v) =>
    expect(esCifValido(v)).toBe(true),
  );

  it.each(["B12345675", "Q2826000A", "I12345674", "B1234567"])("CIF no válido: %s", (v) =>
    expect(esCifValido(v)).toBe(false),
  );

  it("un autónomo usa DNI/NIE; una empresa, CIF (o NIF de persona física)", () => {
    expect(esNifValido("12345678Z", "autonomo")).toBe(true);
    expect(esNifValido("B12345674", "autonomo")).toBe(false);
    expect(esNifValido("B12345674", "empresa")).toBe(true);
  });
});
