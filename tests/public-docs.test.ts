import { afterEach, describe, expect, it } from "vitest";
import { tieneProcedimiento, validarPublicDocs } from "../scripts/lib/public-docs.mjs";
import { crearProyecto, HOY } from "./_fixtures/proyecto";

describe("public_docs/ del repo", () => {
  it("cumple el contrato con el repo de Docusaurus", () => {
    const hoy = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { errores } = validarPublicDocs({ raizRepo: process.cwd(), hoy });
    expect(errores).toEqual([]);
  });
});

/**
 * Cada caso parte de un proyecto ficticio válido (tests/_fixtures/proyecto.ts),
 * rompe UNA cosa y comprueba que el validador lo ve. No depende de la identidad
 * ni de las páginas de este repo: funciona igual en la plantilla y en cualquier
 * proyecto derivado.
 */
describe("el validador de public_docs", () => {
  let p: ReturnType<typeof crearProyecto>;
  const errores = () => validarPublicDocs({ raizRepo: p.raiz, hoy: HOY }).errores.join("\n");
  const GUIA = "public_docs/seccion/guia.md";

  afterEach(() => p.borrar());

  it("acepta el proyecto de referencia (si no, los demás casos no prueban nada)", () => {
    p = crearProyecto();
    expect(validarPublicDocs({ raizRepo: p.raiz, hoy: HOY }).errores).toEqual([]);
  });

  it("detecta una fecha futura", () => {
    p = crearProyecto();
    p.editar(GUIA, `date: ${HOY}`, "date: 2099-01-01");
    expect(errores()).toMatch(/está en el futuro/);
  });

  it("detecta una fecha que falta", () => {
    p = crearProyecto();
    p.editar(GUIA, /last_update:\n {2}date: .*\n {2}author: .*\n/, "");
    expect(errores()).toMatch(/falta `last_update.date`/);
  });

  it("detecta un campo que no está en el contrato universal", () => {
    p = crearProyecto();
    p.editar(GUIA, "  estado: publicado", "  estado: publicado\n  plan_minimo: basic");
    expect(errores()).toMatch(/`r3zon.plan_minimo` no está en el contrato universal/);
  });

  it("detecta un valor inválido", () => {
    p = crearProyecto();
    p.editar(GUIA, "tipo: guia", "tipo: tutorial");
    expect(errores()).toMatch(/`r3zon.tipo` ausente o inválido: tutorial/);
  });

  it("detecta un enlace roto y un enlace absoluto", () => {
    p = crearProyecto();
    p.editar(GUIA, "(../index.md)", "(../no-existe.md) y [otra](/seccion)");
    const e = errores();
    expect(e).toMatch(/enlace roto `..\/no-existe.md`/);
    expect(e).toMatch(/enlace absoluto `\/seccion`/);
  });

  it("detecta un app_url que no está en rutas-app.json", () => {
    p = crearProyecto();
    p.editar(GUIA, "app_url: /login", "app_url: /no-declarada");
    expect(errores()).toMatch(/`r3zon.app_url: \/no-declarada` no aparece/);
  });

  it("detecta una ruta de rutas-app.json que no existe en la app", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/rutas-app.json",
      '"otras":{',
      '"otras":{"/ruta-inventada":{"label":"X"},',
    );
    expect(errores()).toMatch(/`\/ruta-inventada` no existe en src\/app/);
  });

  it("detecta un HowTo sin procedimiento", () => {
    p = crearProyecto();
    p.editar(GUIA, "## Cómo hacer algo, paso a paso", "## Los pasos");
    expect(errores()).toMatch(/`jsonld: HowTo` exige/);
  });

  it("detecta una página sin «Respuesta corta»", () => {
    p = crearProyecto();
    p.editar(GUIA, "**Respuesta corta.** ", "");
    expect(errores()).toMatch(/Respuesta corta/);
  });

  it("detecta sintaxis MDX", () => {
    p = crearProyecto();
    p.editar(GUIA, "## Qué tener en cuenta", '<Aviso tipo="x" />\n\n## Qué tener en cuenta');
    expect(errores()).toMatch(/sintaxis MDX/);
  });

  it("detecta un slug repetido", () => {
    p = crearProyecto();
    p.editar(GUIA, "slug: /seccion/guia", "slug: /");
    expect(errores()).toMatch(/`slug` \/ repetido/);
  });

  it("acepta un redirect hacia una página que existe", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/redirects.json",
      '"redirects":[]',
      '"redirects":[{"de":"/guias/antigua","a":"/proyecto-prueba/seccion/guia"}]',
    );
    expect(errores()).toBe("");
  });

  it("detecta un redirect hacia una página que no existe", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/redirects.json",
      '"redirects":[]',
      '"redirects":[{"de":"/guias/antigua","a":"/proyecto-prueba/no-existe"}]',
    );
    expect(errores()).toMatch(/"\/guias\/antigua" apunta a/);
  });
});

describe("tieneProcedimiento", () => {
  it("exige lista ORDENADA bajo un «## Cómo …»", () => {
    expect(tieneProcedimiento("## Cómo hacerlo\n\n1. Uno\n2. Dos")).toBe(true);
    expect(tieneProcedimiento("## Cómo hacerlo\n\n- Uno\n- Dos")).toBe(false);
    expect(tieneProcedimiento("## Otra cosa\n\n1. Uno")).toBe(false);
  });
});
