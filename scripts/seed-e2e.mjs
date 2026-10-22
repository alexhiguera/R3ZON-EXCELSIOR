#!/usr/bin/env node
// Crea los usuarios de los specs de Playwright en el Supabase LOCAL.
// Lo encadena `npm run test:e2e` (vía `pretest:e2e`) tras un `db:reset`.

import { USUARIO_E2E } from "../e2e/support/usuarios.mjs";
import { asegurarUsuario, clienteAdminLocal } from "./lib/usuarios-locales.mjs";

try {
  const admin = clienteAdminLocal();
  const r = await asegurarUsuario(admin, USUARIO_E2E);
  console.log(`✓ Usuario E2E ${r.creado ? "creado" : "restablecido"}: ${USUARIO_E2E.email}`);
} catch (err) {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
}
