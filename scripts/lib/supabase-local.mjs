// =============================================================================
// El stack LOCAL de Supabase de este proyecto
// =============================================================================
// Los puertos se leen de `supabase/config.toml`, que es su única fuente: cada
// proyecto R3ZON usa su propio rango para convivir con los demás en la misma
// máquina, y escribirlos a mano en scripts y tests es cómo un test acaba
// hablando con la base de OTRO proyecto.
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Puerto de una sección de `config.toml` (`[api]`, `[db]`…).
 *
 * @param {string} toml contenido del fichero
 * @param {string} seccion nombre sin corchetes
 * @returns {number | null}
 */
export function puertoDeSeccion(toml, seccion) {
  const inicio = toml.search(new RegExp(`^\\[${seccion.replace(".", "\\.")}\\]\\s*$`, "m"));
  if (inicio === -1) return null;
  const resto = toml.slice(inicio).split("\n").slice(1);
  for (const linea of resto) {
    if (/^\[/.test(linea)) break;
    const m = linea.match(/^port\s*=\s*(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function leerConfig(raiz = process.cwd()) {
  return readFileSync(resolve(raiz, "supabase/config.toml"), "utf8");
}

/** URL de PostgreSQL del stack local (la de los tests de BD y Prisma). */
export function urlBaseLocal(raiz = process.cwd()) {
  const puerto = puertoDeSeccion(leerConfig(raiz), "db");
  if (!puerto) throw new Error("supabase/config.toml no declara [db] port.");
  return `postgresql://postgres:postgres@127.0.0.1:${puerto}/postgres`;
}

/** URL de la API del stack local. */
export function urlApiLocal(raiz = process.cwd()) {
  const puerto = puertoDeSeccion(leerConfig(raiz), "api");
  if (!puerto) throw new Error("supabase/config.toml no declara [api] port.");
  return `http://127.0.0.1:${puerto}`;
}

/**
 * Claves del stack local según `supabase status -o env`. Falla alto si el
 * stack no está levantado: un script que siguiera sin claves fallaría más
 * abajo con un mensaje que no apunta a la causa.
 *
 * @returns {{ url: string, publishableKey: string, serviceRoleKey: string, dbUrl: string }}
 */
export function clavesLocales() {
  let salida;
  try {
    salida = execFileSync("npx", ["--no-install", "supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("El Supabase local no está levantado. Arráncalo con: npm run db:start");
  }
  const env = {};
  for (const linea of salida.split("\n")) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  const publishableKey = env.PUBLISHABLE_KEY ?? env.ANON_KEY;
  const serviceRoleKey = env.SECRET_KEY ?? env.SERVICE_ROLE_KEY;
  if (!env.API_URL || !publishableKey || !serviceRoleKey) {
    throw new Error(`«supabase status -o env» no devolvió las claves esperadas:\n${salida}`);
  }
  return { url: env.API_URL, publishableKey, serviceRoleKey, dbUrl: env.DB_URL ?? urlBaseLocal() };
}
