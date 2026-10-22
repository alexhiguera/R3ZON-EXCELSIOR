import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Documentación que describe el código y se quedaría atrás sin que nadie lo
 * note. Solo se vigila lo que es barato de comprobar de forma exacta.
 */
describe("docs/STACK.md", () => {
  it("explica cada dependencia de runtime de package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const stack = readFileSync("docs/STACK.md", "utf8");
    const sinExplicar = Object.keys(pkg.dependencies).filter((d) => !stack.includes(`\`${d}\``));
    expect(sinExplicar, "añádelas a la tabla «Dependencias de la app»").toEqual([]);
  });
});
