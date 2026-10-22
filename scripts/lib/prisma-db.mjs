// =============================================================================
// Piezas puras de scripts/prisma-db.mjs
// =============================================================================
// Separadas del script para probarlas sin base ni CLI de Prisma
// (tests/unit/scripts-db.test.ts). El porqué de cada decisión, en docs/DATABASE.md.
// =============================================================================

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Qué hay detrás de una URL de PostgreSQL, sin la contraseña.
 *
 * @param {string | undefined} url
 * @returns {{ local: boolean, host: string, legible: string } | null}
 */
export function describirDestino(url) {
  if (!url) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
  const host = u.hostname.toLowerCase();
  return {
    local: HOSTS_LOCALES.has(host),
    host,
    legible: `${u.protocol}//${decodeURIComponent(u.username)}${u.password ? ":****" : ""}@${u.host}${u.pathname}`,
  };
}

/**
 * Decide contra qué base trabaja Prisma, o por qué se niega.
 *
 * Solo vale una base LOCAL. Prisma es herramienta de desarrollo y pruebas:
 * contra producción no se lanza nada desde aquí (ver docs/DATABASE.md). La
 * pregunta «¿contra qué base va esto?» la contesta el script, no la memoria de
 * quien lo lanza.
 *
 * @param {{ explicita: string | undefined, porDefecto: string }} p
 * @returns {{ ok: true, url: string, destino: NonNullable<ReturnType<typeof describirDestino>> } | { ok: false, motivo: string }}
 */
export function resolverDestino({ explicita, porDefecto }) {
  const url = explicita || porDefecto;
  const destino = describirDestino(url);
  if (!destino) return { ok: false, motivo: "DATABASE_URL no es una URL de PostgreSQL." };
  if (!destino.local) {
    return {
      ok: false,
      motivo: `DATABASE_URL apunta a ${destino.host}, que no es una base local. Prisma solo se usa en local y en pruebas.`,
    };
  }
  return { ok: true, url, destino };
}

/**
 * Esquemas que se introspeccionan. `auth` entra solo porque sin él Prisma no
 * introspecciona nada: `profiles` tiene FK a `auth.users` y la introspección se
 * niega con P4002. Se quita después con `soloPublic`.
 */
export const ESQUEMAS_INTROSPECCION = ["public", "auth"];

export const CABECERA = `// ─────────────────────────────────────────────────────────────────────────────
// GENERADO con \`npm run db:pull\`. No se edita a mano.
//
// Sale de introspeccionar la base LOCAL, que es el resultado de aplicar
// supabase/migrations/: esa es la fuente de verdad del esquema, no este fichero.
// Tocar esto no cambia la base, y CI (\`npm run db:drift\`) falla si deja de
// coincidir con lo que producen las migraciones.
//
// Solo el esquema \`public\`. Las FK hacia \`auth.users\` existen en la base pero
// no aquí: \`auth\` es de Supabase y queda fuera a propósito.
//
// Lo que Prisma no representa y SÍ existe en la base: la RLS y sus policies, las
// funciones, los triggers, los CHECK y los grants. Guía: docs/DATABASE.md
// ─────────────────────────────────────────────────────────────────────────────`;

/**
 * Parte un schema de Prisma en sus bloques de primer nivel, con los `///` que
 * lleve encima cada uno.
 *
 * @param {string} texto
 * @returns {{ tipo: string, nombre: string, docs: string[], cuerpo: string[] }[]}
 */
export function bloquesDelSchema(texto) {
  const lineas = texto.replace(/\r\n/g, "\n").split("\n");
  const bloques = [];
  let docs = [];
  for (let i = 0; i < lineas.length; i++) {
    const cabecera = lineas[i].match(
      /^(model|enum|view|type|generator|datasource)\s+(\w+)\s*\{\s*$/,
    );
    if (!cabecera) {
      docs = lineas[i].startsWith("///") ? [...docs, lineas[i]] : [];
      continue;
    }
    const cuerpo = [lineas[i]];
    while (i + 1 < lineas.length && lineas[i] !== "}") {
      i++;
      cuerpo.push(lineas[i]);
    }
    bloques.push({ tipo: cabecera[1], nombre: cabecera[2], docs, cuerpo });
    docs = [];
  }
  return bloques;
}

function esquemaDe(bloque) {
  for (const linea of bloque.cuerpo) {
    const m = linea.match(/^\s*@@schema\("([^"]+)"\)\s*$/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Deja solo `public` a partir de una introspección de `public` + `auth`.
 *
 * De cada modelo de `public` se quitan los campos de RELACIÓN hacia modelos de
 * `auth` (no son columnas). Una columna de `public` con un tipo de `auth`, un
 * esquema inesperado o un nombre repetido lanzan: mejor parar que escribir un
 * schema que miente.
 *
 * @param {string} introspeccion salida de `prisma db pull --print`
 * @returns {string}
 */
export function soloPublic(introspeccion) {
  const bloques = bloquesDelSchema(introspeccion);
  const generador = bloques.find((b) => b.tipo === "generator");
  if (!generador) throw new Error("La introspección no trae el bloque generator.");

  const modelosDeAuth = new Set();
  const tiposDeAuth = new Set();
  const nombres = new Set();
  const publicos = [];
  for (const b of bloques) {
    if (b.tipo === "generator" || b.tipo === "datasource") continue;
    if (nombres.has(b.nombre)) throw new Error(`Nombre repetido en la introspección: ${b.nombre}`);
    nombres.add(b.nombre);
    const esquema = esquemaDe(b);
    if (esquema === "public") publicos.push(b);
    else if (esquema === "auth") (b.tipo === "model" ? modelosDeAuth : tiposDeAuth).add(b.nombre);
    else throw new Error(`${b.tipo} ${b.nombre} está en un esquema inesperado: ${esquema}`);
  }
  if (publicos.length === 0) throw new Error("La introspección no trae nada de public.");

  const limpiar = (b) => {
    const cuerpo = b.cuerpo.filter((linea) => {
      if (/^\s*@@schema\("public"\)\s*$/.test(linea)) return false;
      const campo = b.tipo === "model" && linea.match(/^\s+(\w+)\s+(\w+)(\?|\[\])?(\s|$)/);
      if (!campo) return true;
      if (tiposDeAuth.has(campo[2])) {
        throw new Error(`${b.nombre}.${campo[1]} es una columna de public con un tipo de auth.`);
      }
      return !modelosDeAuth.has(campo[2]);
    });
    while (cuerpo.length > 2 && cuerpo.at(-2).trim() === "") cuerpo.splice(-2, 1);
    return [...b.docs, ...cuerpo].join("\n");
  };

  return `${[
    CABECERA,
    generador.cuerpo.join("\n"),
    'datasource db {\n  provider = "postgresql"\n}',
    ...publicos.map(limpiar),
  ].join("\n\n")}\n`;
}
