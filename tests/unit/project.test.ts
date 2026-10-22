import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { project } from "@/config/project";
import { comprobarDerivacion, comprobarIdentidad } from "../../scripts/lib/identidad.mjs";
import { rutaExisteEnApp } from "../../scripts/lib/public-docs.mjs";
import { crearProyecto, PROYECTO } from "../_fixtures/proyecto";

const REPO = process.cwd();

/** Lo que tiene que ser verdad en ESTE repo, sea la plantilla o un proyecto derivado. */
describe("configuración de este proyecto", () => {
  it("la identidad de project.ts coincide con package.json, config.toml y public_docs/_meta", () => {
    expect(comprobarIdentidad({ raizRepo: REPO, proyecto: project })).toEqual([]);
  });

  it("no arrastra puertos ni documentos reservados por la plantilla", () => {
    expect(comprobarDerivacion({ raizRepo: REPO, proyecto: project })).toEqual([]);
  });

  it("homePath apunta a una página que existe (cambiarlo exige renombrar la carpeta)", () => {
    expect(rutaExisteEnApp(REPO, project.homePath)).toBe(true);
  });

  it("el origen local de Supabase Auth es el mismo que usa la app en desarrollo", () => {
    const siteUrl = readFileSync("supabase/config.toml", "utf8").match(
      /^site_url\s*=\s*"([^"]+)"/m,
    )?.[1];
    const envExample = readFileSync(".env.example", "utf8").match(
      /^NEXT_PUBLIC_SITE_URL=(.*)$/m,
    )?.[1];
    expect(siteUrl).toBe(envExample);
  });
});

describe("comprobarIdentidad detecta", () => {
  let p: ReturnType<typeof crearProyecto>;
  const errores = (cambios: Partial<typeof PROYECTO> = {}) =>
    comprobarIdentidad({ raizRepo: p.raiz, proyecto: { ...PROYECTO, ...cambios } }).join("\n");
  afterEach(() => p.borrar());

  it("nada en un proyecto coherente", () => {
    p = crearProyecto();
    expect(errores()).toBe("");
  });

  it.each([
    ["el nombre", { name: "Otro" }, /softwareApplication\.name[\s\S]*index\.md/],
    ["el slug", { slug: "otro-slug" }, /package\.json[\s\S]*project_id[\s\S]*sitioDocumentacion/],
    ["la descripción", { description: "Otra." }, /softwareApplication\.description/],
    ["el dominio", { domain: "otro.test" }, /sitioProducto[\s\S]*ids\.[\s\S]*rutas-app\.json/],
    ["la organización", { organization: "Otra" }, /organization\.name/],
    ["el idioma", { locale: "en-GB" }, /inLanguage/],
  ])("%s cambiado solo en project.ts", (_campo, cambios, patron) => {
    p = crearProyecto();
    expect(errores(cambios)).toMatch(patron);
  });

  it("un slug con mayúsculas o espacios", () => {
    p = crearProyecto();
    p.editar("package.json", PROYECTO.slug, "Mal Slug");
    expect(errores({ slug: "Mal Slug" })).toMatch(/minúsculas con guiones/);
  });
});

describe("comprobarDerivacion detecta en un proyecto derivado", () => {
  let p: ReturnType<typeof crearProyecto>;
  const errores = () => comprobarDerivacion({ raizRepo: p.raiz, proyecto: PROYECTO }).join("\n");
  afterEach(() => p.borrar());

  it("nada si ya tiene puertos propios y no conserva documentos de la plantilla", () => {
    p = crearProyecto();
    expect(errores()).toBe("");
  });

  it("los puertos reservados por la plantilla", () => {
    p = crearProyecto();
    p.editar("supabase/config.toml", "port = 56322", "port = 55322");
    expect(errores()).toMatch(/\[db\] port = 55322 es del rango reservado/);
  });

  it("la auditoría de la plantilla heredada", () => {
    p = crearProyecto();
    p.escribir("docs/auditoria-template-final.md", "# Auditoría de la plantilla\n");
    expect(errores()).toMatch(/documentación de la plantilla/);
  });

  it("y no aplica nada en la propia plantilla", () => {
    p = crearProyecto();
    p.editar("supabase/config.toml", "port = 56322", "port = 55322");
    const plantilla = { ...PROYECTO, slug: "r3zon-template" };
    expect(comprobarDerivacion({ raizRepo: p.raiz, proyecto: plantilla })).toEqual([]);
  });
});
