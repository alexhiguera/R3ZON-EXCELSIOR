#!/usr/bin/env node
// Crea (o restablece) el usuario de desarrollo en el Supabase LOCAL.
//
// Credenciales: DEV_EMAIL y DEV_PASSWORD de `.env.local`, o los valores por
// defecto de abajo. Solo existen dentro del Docker local.

import { cargarEntorno } from "./lib/entorno.mjs";
import { asegurarUsuario, clienteAdminLocal } from "./lib/usuarios-locales.mjs";

const env = cargarEntorno();
const usuario = {
  email: env.DEV_EMAIL || "dev@example.test",
  password: env.DEV_PASSWORD || "dev-password-local-only",
  displayName: env.DEV_NOMBRE || "Desarrollo",
};

try {
  const admin = clienteAdminLocal();
  const r = await asegurarUsuario(admin, usuario);
  console.log(`✓ Usuario de desarrollo ${r.creado ? "creado" : "restablecido"}:`);
  console.log(`    email:      ${usuario.email}`);
  console.log(`    contraseña: ${usuario.password}`);
} catch (err) {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
}
