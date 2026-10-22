#!/usr/bin/env node
// =============================================================================
// Prisma contra la base LOCAL, con guardas
// =============================================================================
// Único camino para los comandos de Prisma que se conectan a una base:
//
//   node scripts/prisma-db.mjs pull     schema.prisma ← base local
//   node scripts/prisma-db.mjs drift    ¿coincide la base local con schema.prisma?
//   node scripts/prisma-db.mjs studio   Prisma Studio sobre la base local
//
// Nunca `prisma db push` ni `prisma migrate`: el esquema lo mandan las
// migraciones de supabase/migrations/. Guía completa: docs/DATABASE.md.
//
// Códigos de salida: 0 bien · 1 error · 2 drift (distinto de 1 para que CI
// distinga «hay diferencias» de «no se pudo comparar»).
// =============================================================================

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { leerFicheroEntorno } from "./lib/entorno.mjs";
import { ESQUEMAS_INTROSPECCION, resolverDestino, soloPublic } from "./lib/prisma-db.mjs";
import { urlBaseLocal } from "./lib/supabase-local.mjs";

const SCHEMA = "prisma/schema.prisma";
const CODIGO_DRIFT = 2;
const enCI = process.env.GITHUB_ACTIONS === "true";

function salir(mensaje, codigo = 1) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(codigo);
}

const [comando] = process.argv.slice(2);
const COMANDOS = ["pull", "drift", "studio"];
if (!COMANDOS.includes(comando)) salir(`Uso: prisma-db.mjs <${COMANDOS.join("|")}>`);

const resuelto = resolverDestino({
  explicita: leerFicheroEntorno().DATABASE_URL || process.env.DATABASE_URL,
  porDefecto: urlBaseLocal(),
});
if (!resuelto.ok) salir(resuelto.motivo);
const { url, destino } = resuelto;
console.log(`▸ Base local: ${destino.legible}`);

/** Lanza el CLI de Prisma con la URL de este destino, y solo con esa. */
function prisma(args, { capturar = false } = {}) {
  const r = spawnSync("npx", ["--no-install", "prisma", ...args], {
    encoding: "utf8",
    stdio: capturar ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, DATABASE_URL: url },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) salir(`No se pudo lanzar el CLI de Prisma: ${r.error.message}`);
  return r;
}

function conTemporal(contenido, fn) {
  const dir = mkdtempSync(join(tmpdir(), "prisma-db-"));
  const ruta = join(dir, "schema.prisma");
  try {
    writeFileSync(ruta, contenido);
    return fn(ruta);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Introspecciona la base y devuelve el schema de `public`, ya formateado. */
function introspeccionar() {
  const r = prisma(
    ["db", "pull", "--print", "--force", "--schemas", ESQUEMAS_INTROSPECCION.join(",")],
    { capturar: true },
  );
  if (r.status !== 0) {
    salir(
      `La introspección ha fallado. ¿Está levantado el stack (npm run db:start)?\n${r.stderr || r.stdout}`,
    );
  }
  let filtrado;
  try {
    filtrado = soloPublic(r.stdout);
  } catch (err) {
    salir(`La introspección no se puede reducir a public: ${err.message}`);
  }
  return conTemporal(filtrado, (ruta) => {
    const f = prisma(["format", "--schema", ruta], { capturar: true });
    if (f.status !== 0) salir(`El schema filtrado no es válido:\n${f.stderr || f.stdout}`);
    return readFileSync(ruta, "utf8");
  });
}

function pull() {
  const nuevo = introspeccionar();
  let anterior = "";
  try {
    anterior = readFileSync(SCHEMA, "utf8");
  } catch {
    // Primera vez: no hay schema previo.
  }
  const modelos = (nuevo.match(/^model /gm) ?? []).length;
  if (nuevo === anterior) {
    console.log(`✓ ${SCHEMA} ya estaba al día (${modelos} modelos).`);
    return;
  }
  writeFileSync(SCHEMA, nuevo);
  console.log(`✓ ${SCHEMA} regenerado: ${modelos} modelos.`);
  console.log("  Revisa el diff: tiene que corresponder a una migración de supabase/migrations/.");
}

function drift() {
  const real = introspeccionar();
  const diff = conTemporal(real, (ruta) =>
    prisma(["migrate", "diff", "--from-schema", SCHEMA, "--to-schema", ruta, "--exit-code"], {
      capturar: true,
    }),
  );
  const salida = `${diff.stdout}${diff.stderr}`.replace(/^Loaded Prisma config.*\n+/m, "").trim();

  if (diff.status === 0) {
    if (real !== readFileSync(SCHEMA, "utf8")) {
      const aviso = `Sin diferencias de estructura, pero ${SCHEMA} no es idéntico a la introspección (comentarios o formato). Se arregla con npm run db:pull.`;
      console.log(enCI ? `::warning::${aviso}` : `! ${aviso}`);
    }
    console.log(`✓ La base local coincide con ${SCHEMA}.`);
    return;
  }
  if (diff.status !== CODIGO_DRIFT) salir(`No se pudo comparar:\n${salida}`);

  console.log(`\nLo que tiene la base respecto a ${SCHEMA}:\n\n${salida}\n`);
  console.log(
    [
      "Casi siempre es una migración sin su schema. Con la base local al día",
      "(npm run db:reset si da igual perder los datos locales):",
      "    npm run db:pull",
      `y commitea ${SCHEMA} junto a la migración.`,
    ].join("\n"),
  );
  process.exit(CODIGO_DRIFT);
}

function studio() {
  const r = prisma(["studio", "--port", "5555"]);
  process.exit(r.status ?? 0);
}

try {
  if (comando === "pull") pull();
  else if (comando === "drift") drift();
  else studio();
} catch (err) {
  salir(err?.message ?? String(err));
}
