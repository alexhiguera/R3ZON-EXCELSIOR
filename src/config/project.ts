/**
 * Identidad del proyecto: el ÚNICO sitio del código donde vive.
 *
 * El código de la app no escribe nunca el nombre, el dominio o el idioma a
 * mano: los lee de aquí. Los ficheros que no pueden importar TypeScript
 * (`package.json`, `supabase/config.toml`, `public_docs/_meta/*.json`) repiten
 * algunos valores, y `npm run docs:validar` comprueba que coinciden con este
 * fichero (lo importa directamente). Pasos completos: docs/TEMPLATE.md.
 *
 * Los valores de abajo son neutros a propósito. Si alguno llega a producción
 * sin cambiar, se nota enseguida (`example.com`), que es lo que se quiere.
 */
export const project = {
  /**
   * Nombre visible del producto: `<title>`, cabecera de la app, metadatos.
   * Validado contra `entidad.json` (`softwareApplication.name`) y el título de
   * `public_docs/index.md`.
   */
  name: "R3ZON Template",
  /**
   * Identificador corto (minúsculas y guiones). La app no lo lee en runtime:
   * es el nombre que `docs:validar` exige en `package.json` (`name`),
   * `supabase/config.toml` (`project_id`) y la ruta de la documentación
   * pública (`docs.r3zon.com/<slug>`, id del producto en R3ZON-Docusaurus).
   */
  slug: "r3zon-template",
  /** Descripción de una frase: metadatos y `entidad.json`. */
  description: "Plantilla base de proyectos SaaS de R3ZON.",
  /** Dominio de la app en producción, sin protocolo: URL pública, `entidad.json`, `rutas-app.json`. */
  domain: "app.example.com",
  /** Organización propietaria: metadatos (`publisher`, `creator`) y `entidad.json`. */
  organization: "R3ZON",
  /**
   * Idioma del producto (BCP 47). Configura `<html lang>`, `og:locale` y el
   * `inLanguage` de `entidad.json`.
   *
   * NO traduce nada: los textos de la interfaz están escritos en español en los
   * componentes. Un producto en otro idioma los reescribe a mano; uno con varios
   * idiomas necesita el módulo `i18n` (modules/README.md).
   */
  locale: "es-ES",
  /**
   * Ruta a la que se entra tras iniciar sesión. Debe existir como página en
   * `src/app/(app)/`: cambiarla implica RENOMBRAR la carpeta
   * `src/app/(app)/inicio/` y su entrada en `public_docs/_meta/rutas-app.json`.
   * Los tests y los E2E leen este valor, y `tests/unit/project.test.ts` falla
   * si la página no existe.
   */
  homePath: "/inicio",
} as const;

/** Código de idioma corto para `<html lang>`. */
export const htmlLang = project.locale.split("-")[0] ?? "es";

/**
 * URL pública del sitio. Si no hay `NEXT_PUBLIC_SITE_URL`, el dominio del
 * proyecto.
 *
 * Ojo: `robots.txt` y `sitemap.xml` son estáticos y se generan en el BUILD, así
 * que la URL queda fijada con el valor que tuviera la variable al compilar.
 */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${project.domain}`;
}
