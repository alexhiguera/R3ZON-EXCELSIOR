#!/usr/bin/env node
// Crea una invitación en el Supabase LOCAL e imprime el enlace.
//
//   npm run dev:invitar -- cliente@empresa.test "Empresa S.L." [owner|member|billing]
//
// Sustituye al panel de R3ZON mientras no exista (Fase 2, docs/PLAN.md).

import { crearInvitacionLocal } from "./lib/invitaciones-locales.mjs";

const [email, empresa = "Empresa de prueba", rol = "owner"] = process.argv.slice(2);
if (!email || !["owner", "member", "billing"].includes(rol)) {
  console.error('Uso: npm run dev:invitar -- <email> ["Empresa"] [owner|member|billing]');
  process.exit(1);
}

try {
  const { token } = await crearInvitacionLocal({ email, empresa, rol });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  console.log(`✓ Invitación para ${email} (${rol}) en «${empresa}», válida 7 días:`);
  console.log(`    ${base}/invitacion/${token}`);
} catch (err) {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
}
