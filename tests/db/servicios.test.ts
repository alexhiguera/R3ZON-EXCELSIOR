import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import { comoPostgres, crearServicio, fallo, hacerStaff } from "./_excelsior";

/** Módulo SERVICIOS: catálogo versionado, gestionado solo por admin. */
afterAll(async () => {
  await db?.end();
});

describe.skipIf(!db)("servicios", () => {
  it("solo un admin crea servicios y versiones; el staff los lee", async () => {
    await inRollback(async (c) => {
      const admin = await createAuthUser(c, { email: "admin@r3zon.test" });
      const staff = await createAuthUser(c, { email: "staff@r3zon.test" });
      await hacerStaff(c, admin, "admin");
      await hacerStaff(c, staff, "staff");

      await actAs(c, staff);
      expect(await fallo(c, "insert into public.services (name) values ('Web')")).toMatch(
        /row-level security/,
      );

      await comoPostgres(c);
      await actAs(c, admin);
      const { rows } = await c.query(
        "insert into public.services (name) values ('Web corporativa') returning id, created_by",
      );
      expect(rows[0].created_by).toBe(admin);
      await c.query(
        "insert into public.service_versions (service_id, price_cents, includes) values ($1, 150000, array[' Diseño ', 'Diseño', '', 'SEO básico'])",
        [rows[0].id],
      );

      await comoPostgres(c);
      await actAs(c, staff);
      const v = await c.query(
        "select version, price_cents, includes from public.services_current where id = $1",
        [rows[0].id],
      );
      expect(v.rows).toEqual([
        { version: 1, price_cents: "150000", includes: ["Diseño", "SEO básico"] },
      ]);
    });
  });

  it("una versión no se modifica ni se borra; cambiar el precio es crear la siguiente", async () => {
    await inRollback(async (c) => {
      const { serviceId, versionId } = await crearServicio(c, "Ecommerce");
      expect(
        await fallo(c, "update public.service_versions set price_cents = 1 where id = $1", [
          versionId,
        ]),
      ).toMatch(/no se modifica/);
      expect(
        await fallo(c, "delete from public.service_versions where id = $1", [versionId]),
      ).toMatch(/no se modifica/);
      await c.query(
        "insert into public.service_versions (service_id, price_cents) values ($1, 200000)",
        [serviceId],
      );
      const { rows } = await c.query(
        "select version, price_cents from public.services_current where id = $1",
        [serviceId],
      );
      expect(rows).toEqual([{ version: 2, price_cents: "200000" }]);
    });
  });

  it("la señal existe si y solo si se ofrece señal + entrega", async () => {
    await inRollback(async (c) => {
      const { serviceId } = await crearServicio(c, "Web");
      const insertar =
        "insert into public.service_versions (service_id, price_cents, payment_plans, deposit_percent) values ($1, 1000, $2::public.payment_plan[], $3)";
      expect(await fallo(c, insertar, [serviceId, ["senal_entrega"], null])).toMatch(/deposit/);
      expect(await fallo(c, insertar, [serviceId, ["pago_unico"], 50])).toMatch(/deposit/);
      expect(await fallo(c, insertar, [serviceId, ["senal_entrega"], 100])).toMatch(/deposit/);
      await c.query(insertar, [serviceId, ["pago_unico", "senal_entrega"], 50]);
    });
  });

  it("un cliente no ve el catálogo", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const { serviceId } = await crearServicio(c, "Web");
      await actAs(c, ana);
      const s = await c.query("select 1 from public.services where id = $1", [serviceId]);
      const v = await c.query("select 1 from public.services_current where id = $1", [serviceId]);
      expect([s.rowCount, v.rowCount]).toEqual([0, 0]);
    });
  });
});
