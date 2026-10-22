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
const DEFINER_FUNCTIONS_FOR_AUTHENTICATED: ReadonlySet<string> = new Set([]);

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
