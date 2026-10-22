import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

const FALLBACK = "/inicio";

describe("safeRedirectPath", () => {
  it("acepta rutas del propio sitio, con query y ancla", () => {
    expect(safeRedirectPath("/inicio", FALLBACK)).toBe("/inicio");
    expect(safeRedirectPath("/a/b?x=1#y", FALLBACK)).toBe("/a/b?x=1#y");
  });

  it.each([
    ["vacío", ""],
    ["nulo", null],
    ["URL absoluta", "https://evil.example/login"],
    ["protocolo relativo", "//evil.example"],
    ["barra invertida", "/\\evil.example"],
    ["tabulador que el navegador elimina", "/\t/evil.example"],
    ["sin barra inicial", "evil.example"],
    ["arroba concatenable al origen", "@evil.example"],
    ["javascript:", "javascript:alert(1)"],
    ["demasiado larga", `/${"a".repeat(3000)}`],
  ])("rechaza %s", (_label, value) => {
    expect(safeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
  });
});
