// =============================================================================
// Crear usuarios en el Supabase LOCAL a través de la API de Auth
// =============================================================================
// Se usa la API de administración (service_role) y no un INSERT en auth.users:
// es el mismo camino que sigue un registro real, así que dispara los mismos
// triggers (`on_auth_user_created` → `profiles`) y lo que se prueba es lo que
// pasará en producción.
//
// Las claves salen de `supabase status`, nunca de `.env.local`: así es
// imposible que este código apunte a otra base que no sea la local.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { esLocal } from "./entorno.mjs";
import { clavesLocales } from "./supabase-local.mjs";

/** Cliente admin del stack local. Lanza si por lo que sea no es local. */
export function clienteAdminLocal() {
  const { url, serviceRoleKey } = clavesLocales();
  if (!esLocal(url)) throw new Error(`Se esperaba un Supabase local y la URL es ${url}.`);
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Crea el usuario o, si ya existe, le restablece contraseña y nombre. Idempotente.
 *
 * @param {ReturnType<typeof clienteAdminLocal>} admin
 * @param {{ email: string, password: string, displayName: string }} datos
 */
export async function asegurarUsuario(admin, { email, password, displayName }) {
  const { data: lista, error: errLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (errLista) throw errLista;
  const existente = lista.users.find((u) => u.email === email);

  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      password,
      user_metadata: { display_name: displayName },
    });
    if (error) throw error;
    return { id: existente.id, creado: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw error;
  return { id: data.user.id, creado: true };
}
