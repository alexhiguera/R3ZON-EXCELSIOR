import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";

/**
 * `public.profiles` contra PostgreSQL real: trigger de alta, RLS, grants,
 * constraints y cascada. Cada test corre en una transacción con ROLLBACK.
 */
describe.skipIf(!db)("profiles", () => {
  afterAll(async () => {
    await db?.end();
  });

  it("el alta de un usuario crea su perfil con el nombre de los metadatos", async () => {
    await inRollback(async (c) => {
      const id = await createAuthUser(c, { email: "ana@example.test", displayName: "  Ana  " });
      const { rows } = await c.query("select display_name from public.profiles where id = $1", [
        id,
      ]);
      expect(rows).toEqual([{ display_name: "Ana" }]);
    });
  });

  it("sin nombre en los metadatos, el perfil nace con display_name nulo", async () => {
    await inRollback(async (c) => {
      const id = await createAuthUser(c, { email: "sin-nombre@example.test" });
      const { rows } = await c.query("select display_name from public.profiles where id = $1", [
        id,
      ]);
      expect(rows).toEqual([{ display_name: null }]);
    });
  });

  it("cada usuario ve SOLO su perfil, aunque pida todos", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test", displayName: "Ana" });
      await createAuthUser(c, { email: "bea@example.test", displayName: "Bea" });

      await actAs(c, ana);
      const { rows } = await c.query("select id, display_name from public.profiles");
      expect(rows).toEqual([{ id: ana, display_name: "Ana" }]);
    });
  });

  it("un usuario no puede modificar el perfil de otro", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test", displayName: "Ana" });
      const bea = await createAuthUser(c, { email: "bea@example.test", displayName: "Bea" });

      await actAs(c, ana);
      const r = await c.query(
        "update public.profiles set display_name = 'hackeado' where id = $1",
        [bea],
      );
      expect(r.rowCount).toBe(0);

      await c.query("reset role");
      const { rows } = await c.query("select display_name from public.profiles where id = $1", [
        bea,
      ]);
      expect(rows[0].display_name).toBe("Bea");
    });
  });

  it("un usuario puede cambiar su nombre, y updated_at avanza", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test", displayName: "Ana" });
      // Dentro de una transacción now() no avanza: se retrasa el valor inicial.
      await c.query(
        "update public.profiles set updated_at = now() - interval '1 hour' where id = $1",
        [ana],
      );

      await actAs(c, ana);
      const r = await c.query(
        "update public.profiles set display_name = 'Ana María' where id = $1 returning display_name, updated_at = now() as avanzado",
        [ana],
      );
      expect(r.rows).toEqual([{ display_name: "Ana María", avanzado: true }]);
    });
  });

  it("un usuario no puede tocar columnas que no son suyas de editar (id, fechas)", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test" });
      await actAs(c, ana);
      await expect(
        c.query("update public.profiles set created_at = now() where id = $1", [ana]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("un usuario no puede crear perfiles a mano (los crea el trigger)", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test" });
      await actAs(c, ana);
      await expect(
        c.query("insert into public.profiles (id) values (gen_random_uuid())"),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("un anónimo no tiene acceso a la tabla", async () => {
    await inRollback(async (c) => {
      await createAuthUser(c, { email: "ana@example.test" });
      await actAs(c, null);
      await expect(c.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
    });
  });

  it("rechaza un display_name de más de 120 caracteres o vacío", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test" });
      await c.query("savepoint s");
      await expect(
        c.query("update public.profiles set display_name = $1 where id = $2", [
          "x".repeat(121),
          ana,
        ]),
      ).rejects.toThrow(/profiles_display_name_length/);
      await c.query("rollback to savepoint s");
      await expect(
        c.query("update public.profiles set display_name = '' where id = $1", [ana]),
      ).rejects.toThrow(/profiles_display_name_length/);
    });
  });

  it("borrar el usuario de auth borra su perfil (cascada)", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test" });
      await c.query("delete from auth.users where id = $1", [ana]);
      const { rowCount } = await c.query("select 1 from public.profiles where id = $1", [ana]);
      expect(rowCount).toBe(0);
    });
  });

  it("nadie puede invocar el trigger de alta como RPC", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@example.test" });
      await actAs(c, ana);
      await expect(c.query("select public.handle_new_user()")).rejects.toThrow(
        /permission denied|trigger functions can only be called as triggers/,
      );
    });
  });
});
