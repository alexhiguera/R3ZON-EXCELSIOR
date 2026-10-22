import { afterAll, describe, expect, it } from "vitest";
import { db, inRollback } from "./_db";

/** `public.uuidv7()`: formato RFC 9562 y orden temporal. */
describe.skipIf(!db)("uuidv7", () => {
  afterAll(async () => {
    await db?.end();
  });

  it("genera UUID de versión 7 y variante RFC", async () => {
    const { rows } = await db!.query<{ id: string }>(
      "select public.uuidv7()::text as id from generate_series(1, 50)",
    );
    for (const { id } of rows) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(rows.map((r) => r.id)).size).toBe(50);
  });

  it("lleva dentro la hora de creación, en milisegundos", async () => {
    const { rows } = await db!.query<{ ms: string; ahora: string }>(
      `select ('x' || lpad(replace(public.uuidv7()::text, '-', ''), 32, '0'))::bit(128)::bit(48)::bigint as ms,
              floor(extract(epoch from clock_timestamp()) * 1000)::bigint as ahora`,
    );
    expect(Math.abs(Number(rows[0]!.ms) - Number(rows[0]!.ahora))).toBeLessThan(1000);
  });

  it("los generados en milisegundos posteriores ordenan después", async () => {
    await inRollback(async (c) => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const { rows } = await c.query<{ id: string }>("select public.uuidv7()::text as id");
        ids.push(rows[0]!.id);
        await c.query("select pg_sleep(0.002)");
      }
      expect([...ids].sort()).toEqual(ids);
    });
  });
});
