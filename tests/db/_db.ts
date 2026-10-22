import { Client } from "pg";
import { urlBaseLocal } from "../../scripts/lib/supabase-local.mjs";

/**
 * Conexión a la base LOCAL para los tests de base de datos.
 *
 * El modelo de seguridad no vive en TypeScript: vive en RLS, triggers y grants.
 * Estos tests son los únicos que lo comprueban, así que su regla más importante
 * es que NO PUEDEN PASAR EN SILENCIO:
 *
 *  - En local, si no hay base, se saltan con un aviso visible. Así no rompen el
 *    bucle de quien no tiene Docker levantado.
 *  - En CI (`CI=true`), si no hay base, FALLAN. En el proyecto de origen esta
 *    suite se saltaba sola en CI porque nadie levantaba Postgres, y durante
 *    meses la única suite que probaba la RLS no corrió nunca, dando verde.
 *
 * La conexión se abre con `await` de nivel superior y no en `beforeAll`:
 * `describe.skipIf` se evalúa al RECOLECTAR los tests, antes que cualquier hook.
 */
async function connect(): Promise<Client | null> {
  const url = process.env.SUPABASE_DB_URL ?? urlBaseLocal();
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
  } catch (err) {
    return unavailable(
      `no se pudo conectar a ${url.replace(/:[^:@/]+@/, ":****@")} (${(err as Error).message})`,
    );
  }

  // Que la base sea la de ESTE proyecto: comprobarlo antes de tocar nada.
  const { rows } = await client.query<{ ok: boolean }>(
    "select to_regclass('public.profiles') is not null as ok",
  );
  if (!rows[0]?.ok) {
    await client.end();
    return unavailable(
      "la base no tiene public.profiles: ¿migraciones sin aplicar (npm run db:reset)?",
    );
  }
  return client;
}

function unavailable(reason: string): null {
  if (process.env.CI) {
    throw new Error(
      `Tests de base de datos sin base en CI: ${reason}. En CI no se permite saltarlos.`,
    );
  }
  console.warn(`\n⚠ Tests de BD SALTADOS: ${reason}.\n  Levanta el stack con npm run db:start.\n`);
  return null;
}

export const db = await connect();

/** Ejecuta `fn` dentro de una transacción que siempre se deshace. */
export async function inRollback<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  if (!db) throw new Error("Sin base de datos");
  await db.query("begin");
  try {
    return await fn(db);
  } finally {
    await db.query("rollback");
  }
}

/**
 * Actúa como un usuario autenticado dentro de la transacción: el rol y los
 * claims del JWT que PostgREST pondría en una petición real. `auth.uid()` lee
 * `request.jwt.claims`.
 */
export async function actAs(c: Client, userId: string | null): Promise<void> {
  if (userId === null) {
    await c.query("set local role anon");
    await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    return;
  }
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

/** Crea un usuario en auth.users como lo haría Auth (dispara el trigger de alta). */
export async function createAuthUser(
  c: Client,
  opts: { email: string; displayName?: string },
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', $1, $2::jsonb, now(), now())
     returning id`,
    [opts.email, JSON.stringify(opts.displayName ? { display_name: opts.displayName } : {})],
  );
  return rows[0]!.id;
}
