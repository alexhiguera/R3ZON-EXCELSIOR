import type { Client } from "pg";

/**
 * Ayudas para los tests de BD del dominio de Excelsior. Se ejecutan como
 * `postgres` (sin RLS) para preparar datos; cada test cambia luego de rol con
 * `actAs()` para comprobar lo que ve y hace un usuario.
 */

/** Vuelve a `postgres` y borra los claims del JWT. */
export async function comoPostgres(c: Client): Promise<void> {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
}

export async function crearOrganizacion(c: Client, nombre: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    "insert into public.organizations (name) values ($1) returning id",
    [nombre],
  );
  return rows[0]!.id;
}

export async function hacerStaff(c: Client, userId: string, nivel: "staff" | "admin" = "staff") {
  await c.query("update public.profiles set platform_role = $2 where id = $1", [userId, nivel]);
}

export async function hacerMiembro(
  c: Client,
  organizationId: string,
  userId: string,
  rol: "owner" | "member" | "billing" = "member",
) {
  await c.query(
    "insert into public.organization_members (organization_id, user_id, role) values ($1, $2, $3)",
    [organizationId, userId, rol],
  );
}

/** Crea una invitación con la función real y devuelve el token en claro. */
export async function invitar(
  c: Client,
  organizationId: string,
  email: string,
  rol: "owner" | "member" | "billing" = "owner",
): Promise<string> {
  const { rows } = await c.query<{ token: string }>(
    "select public.create_invitation($1, $2, $3) as token",
    [organizationId, email, rol],
  );
  return rows[0]!.token;
}

/** Inserta una invitación ya caducada (creada hace 10 días, válida 7). */
export async function invitacionCaducada(c: Client, organizationId: string, email: string) {
  const token = "ab".repeat(32);
  await c.query(
    `insert into public.invitations (organization_id, email, role, token_hash, created_at, expires_at)
     values ($1, $2, 'owner', extensions.digest($3, 'sha256'), now() - interval '10 days', now() - interval '3 days')`,
    [organizationId, email, token],
  );
  return token;
}

/**
 * Ejecuta `sql` esperando que falle, sin abortar la transacción del test
 * (savepoint). Devuelve el mensaje de error, o lanza si NO falló.
 */
export async function fallo(c: Client, sql: string, params: unknown[] = []): Promise<string> {
  await c.query("savepoint fallo_esperado");
  try {
    await c.query(sql, params);
  } catch (err) {
    await c.query("rollback to savepoint fallo_esperado");
    return (err as Error).message;
  }
  await c.query("release savepoint fallo_esperado");
  throw new Error(`Se esperaba un error y no lo hubo: ${sql}`);
}

/** Evento del hook `before_user_created` como lo envía Supabase Auth. */
export function eventoAlta(email: string, provider: "email" | "google", metadata: object = {}) {
  return JSON.stringify({
    metadata: { name: "before-user-created" },
    user: { email, app_metadata: { provider, providers: [provider] }, user_metadata: metadata },
  });
}

/** Crea un servicio con su primera versión (como postgres). Devuelve los ids. */
export async function crearServicio(
  c: Client,
  nombre: string,
  opciones: { precio?: number; planes?: string[]; senal?: number | null } = {},
): Promise<{ serviceId: string; versionId: string }> {
  const s = await c.query<{ id: string }>(
    "insert into public.services (name) values ($1) returning id",
    [nombre],
  );
  const serviceId = s.rows[0]!.id;
  const v = await c.query<{ id: string }>(
    `insert into public.service_versions (service_id, price_cents, payment_plans, deposit_percent)
     values ($1, $2, $3::public.payment_plan[], $4) returning id`,
    [
      serviceId,
      opciones.precio ?? 150000,
      opciones.planes ?? ["pago_unico"],
      opciones.senal ?? null,
    ],
  );
  return { serviceId, versionId: v.rows[0]!.id };
}

/** Crea una contratación en borrador (como postgres). */
export async function crearContratacion(c: Client, organizationId: string, versionId: string) {
  const { rows } = await c.query<{ id: string }>(
    `insert into public.engagements (organization_id, service_version_id, price_cents)
     values ($1, $2, 150000) returning id`,
    [organizationId, versionId],
  );
  return rows[0]!.id;
}
