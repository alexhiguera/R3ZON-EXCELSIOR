#!/usr/bin/env node
/**
 * Comprueba que los enlaces relativos de la documentación INTERNA (docs/,
 * modules/, README.md, CLAUDE.md) apunten a ficheros que existen.
 *
 * Por qué: un enlace roto en Markdown no rompe ningún build, así que solo lo ve
 * quien lo pulsa. En el proyecto de origen, una auditoría encontró cuatro a
 * mano, y uno era el paso 1 de la puesta en producción del README.
 *
 * `docs/CHANGELOG.md` queda fuera a propósito: es histórico y cita rutas que
 * existían cuando se escribió cada entrada.
 * `public_docs/` también: tiene su propio validador (`npm run docs:validar`).
 *
 * Uso: npm run docs:enlaces
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { enlacesDe } from "./lib/public-docs.mjs";

const RAIZ = process.cwd();

function markdownDe(dir) {
  const abs = path.join(RAIZ, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((f) => {
    const rel = path.join(dir, f);
    if (statSync(path.join(RAIZ, rel)).isDirectory()) return markdownDe(rel);
    return f.endsWith(".md") ? [rel] : [];
  });
}

const OBJETIVOS = [
  ...markdownDe("docs").filter((f) => path.basename(f) !== "CHANGELOG.md"),
  ...markdownDe("modules"),
  "README.md",
  "CLAUDE.md",
].filter((f) => existsSync(path.join(RAIZ, f)));

const rotos = [];
let revisados = 0;

for (const rel of OBJETIVOS) {
  const texto = readFileSync(path.join(RAIZ, rel), "utf8");
  const base = path.dirname(path.join(RAIZ, rel));
  for (const { destino, indice } of enlacesDe(texto)) {
    if (/^(https?:|mailto:|#)/.test(destino)) continue;
    // Markdown escapa los paréntesis de los grupos de rutas de Next (`\(app\)`).
    const ruta = destino.split("#")[0].replace(/\\([()])/g, "$1");
    if (!ruta) continue;
    revisados++;
    if (existsSync(path.resolve(base, ruta))) continue;
    const linea = texto.slice(0, indice).split("\n").length;
    rotos.push(`${rel}:${linea}  →  ${ruta}`);
  }
}

console.log(`Enlaces relativos revisados: ${revisados} en ${OBJETIVOS.length} ficheros.`);
if (rotos.length === 0) {
  console.log("✓ Sin enlaces rotos.");
  process.exit(0);
}
console.error(`\n✗ ${rotos.length} enlace(s) roto(s):\n`);
for (const r of rotos) console.error(`  ${r}`);
process.exit(1);
