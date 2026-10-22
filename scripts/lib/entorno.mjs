// =============================================================================
// Carga de entorno para scripts
// =============================================================================
// Los scripts no usan `dotenv`: parsean `.env.local` aquí, en un único sitio.
// El orden importa: se parte de `process.env` y `.env.local` lo tapa, así el
// mismo script sirve en local (fichero) y en CI (variables del entorno, sin
// fichero).
// =============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Solo lo que hay escrito en el fichero, sin `process.env`. Sirve cuando
 * importa DE DÓNDE sale una variable (p. ej. rechazar una URL de producción
 * guardada en disco).
 *
 * @param {string} [ruta]
 * @returns {Record<string, string>}
 */
export function leerFicheroEntorno(ruta = ".env.local") {
  const env = {};
  try {
    for (const linea of readFileSync(resolve(ruta), "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // `.env.local` es opcional: en CI las variables vienen del entorno.
  }
  return env;
}

/** `process.env` con `.env.local` superpuesto. */
export function cargarEntorno(ruta = ".env.local") {
  return { ...process.env, ...leerFicheroEntorno(ruta) };
}

/** ¿La URL apunta a un Supabase local? Lo usan las guardas anti-producción. */
export function esLocal(url) {
  return typeof url === "string" && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
}
