#!/usr/bin/env node
// Cambia el nivel de plataforma de un usuario del Supabase LOCAL.
//
//   npm run dev:staff -- dev@example.test [admin|staff|client]
//
// En producción no hay script: lo hace un admin (docs/ROLES.md).

import { cambiarNivelLocal } from "./lib/invitaciones-locales.mjs";

const [email, nivel = "admin"] = process.argv.slice(2);
if (!email || !["admin", "staff", "client"].includes(nivel)) {
  console.error("Uso: npm run dev:staff -- <email> [admin|staff|client]");
  process.exit(1);
}

try {
  const existe = await cambiarNivelLocal(email, nivel);
  if (!existe) throw new Error(`No hay ningún usuario local con el email ${email}`);
  console.log(`✓ ${email} es ahora «${nivel}». Vuelve a cargar la página para verlo.`);
} catch (err) {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
}
