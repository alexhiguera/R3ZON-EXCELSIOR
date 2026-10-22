#!/usr/bin/env node
// Regenera `src/lib/database.types.ts` desde el Supabase LOCAL, o comprueba
// que el fichero versionado sigue correspondiendo a las migraciones.
//
//   node scripts/db-types.mjs              → regenera el fichero
//   node scripts/db-types.mjs --comprobar  → no escribe; sale con 1 si difiere (CI)
//
// Por qué no es una línea en package.json (`supabase gen types … > fichero`):
// con una redirección de shell, si el comando falla el fichero ya se ha
// truncado, y el repo se queda con unos tipos vacíos que rompen el typecheck
// lejos de la causa. Aquí se escribe solo si la generación ha ido bien.
//
// Por qué la comprobación: sin ella, una migración nueva sin `npm run db:types`
// pasa el typecheck con tipos viejos y el fallo aparece en runtime. La base
// local es el resultado de aplicar supabase/migrations/ (la fuente de verdad) y
// la CLI está fijada en el lockfile, así que la salida es reproducible.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DESTINO = "src/lib/database.types.ts";
const CABECERA =
  "// GENERADO con `npm run db:types` desde el Supabase local. No se edita a mano.\n\n";
const comprobar = process.argv.includes("--comprobar");

const r = spawnSync(
  "npx",
  ["--no-install", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

if (r.status !== 0 || !r.stdout.includes("export type Database")) {
  console.error("✗ No se pudieron generar los tipos. ¿Está levantado el stack (npm run db:start)?");
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

const generado = CABECERA + r.stdout;

if (comprobar) {
  let actual = "";
  try {
    actual = readFileSync(DESTINO, "utf8");
  } catch {
    // Sin fichero: difiere.
  }
  if (actual.replace(/\r\n/g, "\n") !== generado) {
    console.error(
      `✗ ${DESTINO} no corresponde a las migraciones actuales.\n` +
        "  Con la base local al día (npm run db:reset): npm run db:types, y commitea el\n" +
        "  fichero junto a la migración.",
    );
    process.exit(1);
  }
  console.log(`✓ ${DESTINO} corresponde a las migraciones.`);
} else {
  writeFileSync(DESTINO, generado);
  console.log(`✓ ${DESTINO} regenerado.`);
}
