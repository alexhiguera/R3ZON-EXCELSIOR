#!/usr/bin/env node
// Crea los usuarios de los specs de Playwright en el Supabase LOCAL.
// Lo encadena `npm run test:e2e` (vía `pretest:e2e`) tras un `db:reset`.

import { ADMIN_E2E, USUARIO_E2E } from "../e2e/support/usuarios.mjs";
import { cambiarNivelLocal } from "./lib/invitaciones-locales.mjs";
import { asegurarUsuario, clienteAdminLocal } from "./lib/usuarios-locales.mjs";

try {
  const admin = clienteAdminLocal();
  const r = await asegurarUsuario(admin, USUARIO_E2E);
  console.log(`✓ Usuario E2E ${r.creado ? "creado" : "restablecido"}: ${USUARIO_E2E.email}`);
  // Los usuarios se crean con la API de administración de Auth (service_role),
  // la única vía que no pasa por el hook de invitación: solo existe en local.
  await asegurarUsuario(admin, ADMIN_E2E);
  await cambiarNivelLocal(ADMIN_E2E.email, "admin");
  console.log(`✓ Administrador E2E: ${ADMIN_E2E.email}`);
} catch (err) {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
}
