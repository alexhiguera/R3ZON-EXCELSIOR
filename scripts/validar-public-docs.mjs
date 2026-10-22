#!/usr/bin/env node
// Valida `public_docs/` contra el contrato con el repo de Docusaurus
// (public_docs/README.md) y la identidad del proyecto contra
// src/config/project.ts. Sale con código 1 si hay errores: corre en CI.
//
// Uso: npm run docs:validar

import { comprobarIdentidad } from "./lib/identidad.mjs";
import { validarPublicDocs } from "./lib/public-docs.mjs";

// project.ts se importa tal cual: Node 24 ejecuta TypeScript sin compilar
// (solo quita los tipos), así que la fuente de la identidad es una sola.
const { project } = await import("../src/config/project.ts");

// «No futura» con un día de margen sobre UTC: las fechas se escriben a mano en
// la hora local de quien documenta (España, UTC+1/+2) y CI corre en UTC. Sin
// margen, una página fechada «hoy» pasada la medianoche española falla en CI.
const hoy = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const raizRepo = process.cwd();

const docs = validarPublicDocs({ raizRepo, hoy });
const errores = [...docs.errores, ...comprobarIdentidad({ raizRepo, proyecto: project })];

console.log(`public_docs/: ${docs.paginas} página(s) publicables revisadas.`);
for (const a of docs.avisos) console.log(`  ! ${a}`);

if (errores.length === 0) {
  console.log("✓ Cumple el contrato y la identidad coincide con src/config/project.ts.");
  process.exit(0);
}
console.error(`\n✗ ${errores.length} error(es):\n`);
for (const e of errores) console.error(`  · ${e}`);
console.error(
  "\nContrato: public_docs/README.md · Redacción: public_docs/CONVENCIONES.md · Identidad: docs/TEMPLATE.md",
);
process.exit(1);
