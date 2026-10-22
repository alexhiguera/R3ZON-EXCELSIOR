import { describe, expect, it } from "vitest";
import { estaActiva, NAVEGACION, navegacionPara } from "@/config/navegacion";
import { rutaExisteEnApp } from "../../scripts/lib/public-docs.mjs";

describe("navegación", () => {
  it("cada entrada apunta a una página que existe", () => {
    const rotas = NAVEGACION.filter((e) => !rutaExisteEnApp(process.cwd(), e.href)).map(
      (e) => e.href,
    );
    expect(rotas).toEqual([]);
  });

  it("no repite rutas", () => {
    const hrefs = NAVEGACION.map((e) => e.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("filtra por audiencia", () => {
    expect(navegacionPara("cliente").every((e) => e.audiencia.includes("cliente"))).toBe(true);
    expect(navegacionPara("staff").every((e) => e.audiencia.includes("staff"))).toBe(true);
  });

  it.each([
    ["/proyectos", "/proyectos", true],
    ["/proyectos", "/proyectos/42", true],
    ["/proyectos", "/proyectos-archivados", false],
    ["/proyectos", "/", false],
  ])("estaActiva(%s, %s) → %s", (href, pathname, esperado) => {
    expect(estaActiva(href, pathname)).toBe(esperado);
  });
});
