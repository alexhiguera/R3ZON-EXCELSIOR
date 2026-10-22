// =============================================================================
// Identidad del proyecto: ¿dicen lo mismo todos los ficheros que la repiten?
// =============================================================================
// `src/config/project.ts` es la fuente. Estos ficheros no pueden importarlo y
// repiten parte de sus valores:
//
//   package.json                   name            = slug
//   supabase/config.toml           project_id      = slug
//   public_docs/_meta/entidad.json dominio, nombre, descripción, idioma,
//                                  organización y ruta de docs (/<slug>)
//   public_docs/_meta/rutas-app.json  base          = https://<dominio>
//   public_docs/index.md           title contiene el nombre
//
// Si divergen, el JSON-LD de la documentación declara un producto distinto del
// de la app, o dos proyectos comparten id de stack local. Funciones puras: el
// proyecto llega por parámetro (tests con fixtures; el script lo importa de
// project.ts, que Node 24 ejecuta sin compilar).
//
// Además, `comprobarDerivacion` detecta lo que un proyecto DERIVADO ha heredado
// de la plantilla sin darse cuenta (puertos reservados, documentos de la
// plantilla). En la propia plantilla no aplica.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { separarFrontmatter } from "./public-docs.mjs";
import { puertoDeSeccion } from "./supabase-local.mjs";

/** @typedef {{ name: string, slug: string, description: string, domain: string, organization: string, locale: string }} Proyecto */

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {{ raizRepo: string, proyecto: Proyecto }} p
 * @returns {string[]} errores
 */
export function comprobarIdentidad({ raizRepo, proyecto }) {
  const errores = [];
  const err = (fichero, campo, real, esperado) =>
    errores.push(
      `${fichero}: ${campo} es ${JSON.stringify(real)} y src/config/project.ts dice ${JSON.stringify(esperado)}`,
    );
  const r = (rel) => path.join(raizRepo, rel);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(proyecto.slug)) {
    errores.push(
      `src/config/project.ts: slug ${JSON.stringify(proyecto.slug)} debe ir en minúsculas con guiones`,
    );
  }

  const pkg = leerJson(r("package.json"));
  if (pkg && pkg.name !== proyecto.slug) err("package.json", "name", pkg.name, proyecto.slug);

  if (existsSync(r("supabase/config.toml"))) {
    const idStack = readFileSync(r("supabase/config.toml"), "utf8").match(
      /^project_id\s*=\s*"([^"]*)"/m,
    )?.[1];
    if (idStack !== proyecto.slug) {
      err("supabase/config.toml", "project_id", idStack, proyecto.slug);
    }
  }

  const entidad = leerJson(r("public_docs/_meta/entidad.json"));
  if (entidad) {
    const f = "public_docs/_meta/entidad.json";
    const app = `https://${proyecto.domain}`;
    if (entidad.sitioProducto !== app) err(f, "sitioProducto", entidad.sitioProducto, app);
    for (const [k, id] of Object.entries(entidad.ids ?? {})) {
      if (typeof id !== "string" || !id.startsWith(`${app}/#`)) {
        err(f, `ids.${k}`, id, `${app}/#${k === "softwareApplication" ? "software" : k}`);
      }
    }
    let rutaDocs = null;
    try {
      rutaDocs = new URL(entidad.sitioDocumentacion).pathname.replace(/\/$/, "");
    } catch {
      // URL inválida: la reporta validarPublicDocs.
    }
    if (rutaDocs !== `/${proyecto.slug}`) {
      err(f, "la ruta de sitioDocumentacion", rutaDocs, `/${proyecto.slug}`);
    }
    const sw = entidad.softwareApplication ?? {};
    if (sw.name !== proyecto.name) err(f, "softwareApplication.name", sw.name, proyecto.name);
    if (sw.description !== proyecto.description) {
      err(f, "softwareApplication.description", sw.description, proyecto.description);
    }
    if (sw.inLanguage !== proyecto.locale) {
      err(f, "softwareApplication.inLanguage", sw.inLanguage, proyecto.locale);
    }
    if (entidad.organization?.name !== proyecto.organization) {
      err(f, "organization.name", entidad.organization?.name, proyecto.organization);
    }
  }

  const rutasApp = leerJson(r("public_docs/_meta/rutas-app.json"));
  if (rutasApp && rutasApp.base !== `https://${proyecto.domain}`) {
    err("public_docs/_meta/rutas-app.json", "base", rutasApp.base, `https://${proyecto.domain}`);
  }

  if (existsSync(r("public_docs/index.md"))) {
    const titulo = separarFrontmatter(readFileSync(r("public_docs/index.md"), "utf8"))?.datos
      ?.title;
    if (typeof titulo !== "string" || !titulo.includes(proyecto.name)) {
      errores.push(
        `public_docs/index.md: el title ${JSON.stringify(titulo)} no nombra el producto (${JSON.stringify(proyecto.name)})`,
      );
    }
  }

  return errores;
}

/**
 * Qué ha heredado un proyecto derivado que debería haber cambiado o borrado.
 * Devuelve [] en la propia plantilla (slug reservado).
 *
 * @param {{ raizRepo: string, proyecto: Proyecto }} p
 * @returns {string[]} errores
 */
export function comprobarDerivacion({ raizRepo, proyecto }) {
  const plantilla = leerJson(path.join(raizRepo, "r3zon-template.json"));
  if (!plantilla) return ["r3zon-template.json: falta o no es JSON (docs/TEMPLATE.md)"];
  const reservado = plantilla.reservadoPorLaPlantilla;
  if (proyecto.slug === reservado.slug) return [];

  const errores = [];
  const toml = path.join(raizRepo, "supabase/config.toml");
  if (existsSync(toml)) {
    const texto = readFileSync(toml, "utf8");
    for (const [seccion, puerto] of Object.entries(reservado.puertos)) {
      if (puertoDeSeccion(texto, seccion) === puerto) {
        errores.push(
          `supabase/config.toml: [${seccion}] port = ${puerto} es del rango reservado por la plantilla. ` +
            "Elige un rango propio para el proyecto (docs/TEMPLATE.md → Crear un proyecto).",
        );
      }
    }
  }
  for (const doc of reservado.documentos) {
    if (existsSync(path.join(raizRepo, doc))) {
      errores.push(
        `${doc}: es documentación de la plantilla, no del producto. Bórralo (docs/TEMPLATE.md → Documentación al derivar).`,
      );
    }
  }
  return errores;
}
