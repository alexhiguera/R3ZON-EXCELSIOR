#!/usr/bin/env node
// Comprueba si los `overrides` de package.json siguen haciendo falta.
//
// POR QUÉ EXISTE. Un override se añade para dejar atrás un aviso concreto de
// `npm audit`, y a partir de ahí nadie lo vuelve a mirar. Cuando el paquete
// padre sube su propio rango, el override pasa a no servir para nada y nadie lo
// sabe. Criterio: un override está justificado si, al quitarlo, reaparece una
// vulnerabilidad en ESE paquete.
//
// No toca el proyecto: todo ocurre en un directorio temporal que se borra.
//
//   node scripts/verificar-overrides.mjs             → informe
//   node scripts/verificar-overrides.mjs --estricto  → además, código 1 si sobra alguno
//
// CI lo ejecuta SIN `--estricto` a propósito: un override de más es deuda, no
// un fallo de seguridad, y romper el build por deuda entrena a ignorar el build.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function npm(args, cwd) {
  return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const raiz = process.cwd();
const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
const overrides = Object.keys(pkg.overrides ?? {});

if (overrides.length === 0) {
  console.log("No hay overrides que comprobar.");
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "overrides-"));
let vulnerables;
try {
  writeFileSync(join(tmp, "package.json"), JSON.stringify({ ...pkg, overrides: {} }, null, 2));
  writeFileSync(join(tmp, "package-lock.json"), readFileSync(join(raiz, "package-lock.json")));
  console.log("Resolviendo el árbol sin overrides…");
  npm(["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], tmp);
  let informe;
  try {
    informe = npm(["audit", "--json"], tmp);
  } catch (e) {
    // `npm audit` sale con código ≠ 0 cuando encuentra algo; el JSON sigue en stdout.
    informe = e.stdout;
  }
  vulnerables = new Set(Object.keys(JSON.parse(informe).vulnerabilities ?? {}));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const justificados = overrides.filter((n) => vulnerables.has(n));
const obsoletos = overrides.filter((n) => !vulnerables.has(n));

console.log(`\nOverrides: ${overrides.length}`);
for (const n of justificados) console.log(`  ✓ ${n} ${pkg.overrides[n]} — sigue haciendo falta`);
for (const n of obsoletos) console.log(`  ! ${n} ${pkg.overrides[n]} — ya no evita ningún aviso`);
if (obsoletos.length > 0) {
  console.log(
    "\n  Antes de quitarlo, mira qué versión resuelve npm sin él (docs/STACK.md → Dependencias).",
  );
}

if (process.argv.includes("--estricto") && obsoletos.length > 0) process.exit(1);
