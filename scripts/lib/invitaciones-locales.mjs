// =============================================================================
// Invitaciones en el Supabase LOCAL (desarrollo y E2E)
// =============================================================================
// Hasta que exista el panel de R3ZON (Fase 2), la forma de invitar a alguien en
// local es esta. Conecta como `postgres` a la base LOCAL (urlBaseLocal: nunca
// una remota) y usa la MISMA función que usará el panel, `create_invitation`,
// así que el token y el hash salen igual que en producción.
// =============================================================================

import pg from "pg";
import { urlBaseLocal } from "./supabase-local.mjs";

/**
 * Crea (si hace falta) la organización y una invitación para `email`.
 *
 * @param {{ email: string, empresa: string, rol?: "owner" | "member" | "billing" }} opciones
 * @returns {Promise<{ token: string, organizationId: string }>}
 */
export async function crearInvitacionLocal({ email, empresa, rol = "owner" }) {
  const client = new pg.Client({ connectionString: urlBaseLocal() });
  await client.connect();
  try {
    await client.query("begin");
    const existente = await client.query(
      "select id from public.organizations where name = $1 limit 1",
      [empresa],
    );
    const organizationId =
      existente.rows[0]?.id ??
      (
        await client.query("insert into public.organizations (name) values ($1) returning id", [
          empresa,
        ])
      ).rows[0].id;
    const { rows } = await client.query("select public.create_invitation($1, $2, $3) as token", [
      organizationId,
      email,
      rol,
    ]);
    await client.query("commit");
    return { token: rows[0].token, organizationId };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

/**
 * ¿Ha quedado el token de invitación guardado en algún sitio de `auth` para
 * este email? Lo usan los E2E: solo un alta REAL por Supabase Auth dice dónde
 * escribe los metadatos (un test que inserta en auth.users a mano no lo ve).
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function tokenGuardadoEnAuth(email) {
  const client = new pg.Client({ connectionString: urlBaseLocal() });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select exists (
         select 1 from auth.users u left join auth.identities i on i.user_id = u.id
          where lower(u.email) = lower($1)
            and (u.raw_user_meta_data ? 'invitation_token' or i.identity_data ? 'invitation_token')
       ) as guardado`,
      [email],
    );
    return rows[0].guardado;
  } finally {
    await client.end();
  }
}

/**
 * Cambia el nivel de plataforma de un usuario LOCAL (client | staff | admin).
 *
 * @param {string} email
 * @param {"client" | "staff" | "admin"} nivel
 * @returns {Promise<boolean>} si existía el usuario
 */
export async function cambiarNivelLocal(email, nivel) {
  const client = new pg.Client({ connectionString: urlBaseLocal() });
  await client.connect();
  try {
    const r = await client.query(
      `update public.profiles p set platform_role = $2
         from auth.users u where u.id = p.id and lower(u.email) = lower($1)`,
      [email, nivel],
    );
    return r.rowCount === 1;
  } finally {
    await client.end();
  }
}
