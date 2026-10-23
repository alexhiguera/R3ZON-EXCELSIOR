import { afterAll, describe, expect, it } from "vitest";
import { db } from "./_db";

/**
 * Recorre el CATÁLOGO de la base y falla ante cualquier objeto nuevo que rompa
 * las reglas de seguridad del core. No prueba una tabla concreta: prueba todas
 * las que existan hoy y las que añada cualquier módulo o producto mañana.
 *
 * Si uno de estos tests falla tras una migración nueva, lo normal es arreglar
 * la migración (en otra migración), no ampliar las excepciones. Una excepción
 * se añade solo con su motivo escrito al lado.
 */

/** Tablas de `public` que pueden quedar sin RLS. Vacía a propósito. */
const TABLES_WITHOUT_RLS: ReadonlySet<string> = new Set([]);

/** Tablas de `public` que `anon` puede leer o escribir. Vacía a propósito. */
const TABLES_OPEN_TO_ANON: ReadonlySet<string> = new Set([]);

/**
 * Funciones SECURITY DEFINER de `public` que `authenticated` puede ejecutar como
 * RPC. Cada una se salta la RLS, así que cada entrada necesita su porqué.
 */
const DEFINER_FUNCTIONS_FOR_AUTHENTICATED: ReadonlySet<string> = new Set([
  // Las usan las policies. Definer para no entrar en recursión (la policy de
  // una tabla consultaría esa misma tabla). Solo responden sobre el propio
  // usuario: no devuelven filas de nadie.
  "is_staff",
  "is_admin",
  "is_org_member",
  "org_role_of",
  // Aceptar una invitación con una cuenta existente: el usuario aún no
  // pertenece a la organización, y la RLS no le deja ver la invitación ni crear
  // su pertenencia. Las reglas (email, caducidad, un solo uso) las aplica el
  // trigger invitations_guard_transition, no la función.
  "accept_invitation",
  // Emails de los miembros de una empresa, para que el equipo contacte con el
  // cliente. El email vive en auth.users (la app no lo lee) y no se duplica en
  // profiles. La comprobación de staff está DENTRO de la función.
  "organization_directory",
  // Registrar «ver como cliente»: nadie escribe en audit_log directamente. La
  // comprobación de staff está dentro.
  "log_client_view",
  // Pasos del cliente sobre su contratación y su contrato. La RLS de esas
  // tablas solo deja escribir al staff; cada función comprueba dentro
  // pertenencia, rol, estado y (al firmar) el código verificado del email.
  "confirm_engagement_data",
  "sign_contract",
  "delegate_contract_signature",
  // Para policies: ¿es miembro y el contrato ya no es borrador? Definer para no
  // entrar en recursión entre las policies de contratos y de sus partes.
  "contract_visible_to_client",
]);

/**
 * Claves primarias UUID con DEFAULT que no usan `public.uuidv7()`. Vacía a
 * propósito: los ids nuevos son UUIDv7 (migración 20261023000100_base_uuidv7.sql).
 * `profiles.id` no aparece porque no tiene DEFAULT: viene de auth.users.
 */
const UUID_PKS_NOT_V7: ReadonlySet<string> = new Set([]);

/**
 * Tablas que pueden borrarse EN CASCADA al borrar una organización. Solo datos
 * de ACCESO (quién entra): los datos de negocio con obligación de conservación
 * (contratos, facturas, contrataciones…) apuntan con `on delete restrict`, para
 * que nada los arrastre por accidente (docs/RGPD.md, 6 años).
 */
const CASCADE_FROM_ORGANIZATIONS: ReadonlySet<string> = new Set([
  "organization_members",
  "invitations",
]);

describe.skipIf(!db)("catálogo de seguridad", () => {
  afterAll(async () => {
    await db?.end();
  });

  it("toda tabla de public tiene RLS activada", async () => {
    const { rows } = await db!.query<{ table: string }>(
      `select c.relname as table
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
        order by 1`,
    );
    const offenders = rows.map((r) => r.table).filter((t) => !TABLES_WITHOUT_RLS.has(t));
    expect(offenders, "tablas sin RLS").toEqual([]);
  });

  it("anon no tiene ningún privilegio sobre las tablas de public", async () => {
    const { rows } = await db!.query<{ table: string; privilege: string }>(
      `select table_name as table, privilege_type as privilege
         from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public'
        order by 1, 2`,
    );
    const offenders = rows.filter((r) => !TABLES_OPEN_TO_ANON.has(r.table));
    expect(offenders, "grants a anon").toEqual([]);
  });

  it("ninguna función SECURITY DEFINER de public es ejecutable por anon", async () => {
    const { rows } = await db!.query<{ fn: string }>(
      `select p.oid::regprocedure::text as fn
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and has_function_privilege('anon', p.oid, 'execute')
        order by 1`,
    );
    expect(
      rows.map((r) => r.fn),
      "definer ejecutables por anon",
    ).toEqual([]);
  });

  it("las funciones SECURITY DEFINER ejecutables por authenticated están declaradas", async () => {
    const { rows } = await db!.query<{ fn: string; name: string }>(
      `select p.oid::regprocedure::text as fn, p.proname as name
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and has_function_privilege('authenticated', p.oid, 'execute')
        order by 1`,
    );
    const offenders = rows.filter((r) => !DEFINER_FUNCTIONS_FOR_AUTHENTICATED.has(r.name));
    expect(
      offenders.map((r) => r.fn),
      "definer ejecutables por authenticated",
    ).toEqual([]);
  });

  it("toda función SECURITY DEFINER de public fija su search_path", async () => {
    const { rows } = await db!.query<{ fn: string }>(
      `select p.oid::regprocedure::text as fn
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
        order by 1`,
    );
    expect(
      rows.map((r) => r.fn),
      "definer sin search_path",
    ).toEqual([]);
  });

  it("toda clave foránea de public tiene un índice que la cubre", async () => {
    // Sin índice, borrar en la tabla referenciada recorre entera la que
    // referencia, y los JOIN por esa columna tampoco lo usan.
    const { rows } = await db!.query<{ fk: string }>(
      `select c.conrelid::regclass::text || '.' || c.conname as fk
         from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname = 'public'
          and not exists (
            select 1 from pg_index i
             where i.indrelid = c.conrelid
               and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] = c.conkey
          )
        order by 1`,
    );
    expect(
      rows.map((r) => r.fk),
      "FK sin índice",
    ).toEqual([]);
  });

  it("toda clave primaria UUID con default usa public.uuidv7()", async () => {
    const { rows } = await db!.query<{ col: string; def: string }>(
      `select c.relname || '.' || a.attname as col, pg_get_expr(d.adbin, d.adrelid) as def
         from pg_constraint k
         join pg_class c on c.oid = k.conrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
         join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where k.contype = 'p' and n.nspname = 'public' and a.atttypid = 'uuid'::regtype
        order by 1`,
    );
    const offenders = rows.filter(
      (r) => !/^(public\.)?uuidv7\(\)$/.test(r.def) && !UUID_PKS_NOT_V7.has(r.col),
    );
    expect(offenders, "PK UUID sin uuidv7()").toEqual([]);
  });

  it("toda tabla de public con RLS tiene al menos una policy", async () => {
    // RLS sin policies deja la tabla cerrada para todos (no es una fuga), pero
    // casi siempre es un olvido; y una tabla sin policy de SELECT no se puede
    // probar por rol.
    const { rows } = await db!.query<{ table: string }>(
      `select c.relname as table
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
          and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
        order by 1`,
    );
    expect(
      rows.map((r) => r.table),
      "tablas con RLS y sin policies",
    ).toEqual([]);
  });

  it("solo los datos de acceso se borran en cascada con la organización", async () => {
    const { rows } = await db!.query<{ table: string }>(
      `select c.conrelid::regclass::text as table
         from pg_constraint c
        where c.contype = 'f' and c.confrelid = 'public.organizations'::regclass
          and c.confdeltype = 'c'
        order by 1`,
    );
    const offenders = rows
      .map((r) => r.table.replace(/^public\./, ""))
      .filter((t) => !CASCADE_FROM_ORGANIZATIONS.has(t));
    expect(offenders, "datos de negocio con on delete cascade").toEqual([]);
  });

  it("las funciones nuevas de public nacen sin EXECUTE para PUBLIC ni anon", async () => {
    // Comprueba los default privileges que fija la migración core: si alguien
    // los revierte, este test lo ve antes de que aparezca la primera RPC abierta.
    await db!.query("begin");
    try {
      await db!.query(
        "create function public.__probe_default_privs() returns int language sql as 'select 1'",
      );
      const { rows } = await db!.query<{ anon: boolean }>(
        "select has_function_privilege('anon', 'public.__probe_default_privs()', 'execute') as anon",
      );
      expect(rows[0]?.anon).toBe(false);
    } finally {
      await db!.query("rollback");
    }
  });
});
