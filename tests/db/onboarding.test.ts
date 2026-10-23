import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  comoPostgres,
  crearContratacion,
  crearOrganizacion,
  crearServicio,
  datosFiscales,
  fallo,
  hacerMiembro,
  hacerStaff,
} from "./_excelsior";

/**
 * Datos fiscales, confirmación de datos por el cliente, alta de cliente con
 * invitación de una vez y registro de «ver como cliente».
 */
afterAll(async () => {
  await db?.end();
});

describe.skipIf(!db)("datos fiscales", () => {
  it("los editan propietario y facturación; un miembro los lee; otra empresa no los ve", async () => {
    await inRollback(async (c) => {
      const owner = await createAuthUser(c, { email: "ana@acme.test" });
      const miembro = await createAuthUser(c, { email: "luis@acme.test" });
      const ajeno = await createAuthUser(c, { email: "bea@otra.test" });
      const acme = await crearOrganizacion(c, "Acme");
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, acme, owner, "owner");
      await hacerMiembro(c, acme, miembro, "member");
      await hacerMiembro(c, otra, ajeno, "owner");

      await actAs(c, miembro);
      expect(
        await fallo(
          c,
          "insert into public.organization_billing (organization_id, entity_type, legal_name, tax_id, address, postal_code, city) values ($1, 'empresa', 'X', 'B12345678', 'C/ 1', '28001', 'Madrid')",
          [acme],
        ),
      ).toMatch(/row-level security/);

      await comoPostgres(c);
      await actAs(c, owner);
      const { rows } = await c.query(
        "insert into public.organization_billing (organization_id, entity_type, legal_name, tax_id, address, postal_code, city) values ($1, 'empresa', ' Acme S.L. ', 'b-12.345.678', 'C/ 1', '28001', 'Madrid') returning legal_name, tax_id, updated_by",
        [acme],
      );
      expect(rows[0]).toEqual({ legal_name: "Acme S.L.", tax_id: "B12345678", updated_by: owner });

      await comoPostgres(c);
      await actAs(c, miembro);
      expect(
        (
          await c.query("select 1 from public.organization_billing where organization_id = $1", [
            acme,
          ])
        ).rowCount,
      ).toBe(1);
      await comoPostgres(c);
      await actAs(c, ajeno);
      expect(
        (
          await c.query("select 1 from public.organization_billing where organization_id = $1", [
            acme,
          ])
        ).rowCount,
      ).toBe(0);
    });
  });
});

describe.skipIf(!db)("confirmar los datos (invitada → datos_completos)", () => {
  it("exige datos fiscales y rol, y es idempotente", async () => {
    await inRollback(async (c) => {
      const owner = await createAuthUser(c, { email: "ana@acme.test" });
      const miembro = await createAuthUser(c, { email: "luis@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, owner, "owner");
      await hacerMiembro(c, acme, miembro, "member");
      const { versionId } = await crearServicio(c, "Web");
      const e = await crearContratacion(c, acme, versionId);
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);

      await actAs(c, owner);
      expect(await fallo(c, "select public.confirm_engagement_data($1)", [e])).toMatch(
        /Faltan los datos fiscales/,
      );
      await comoPostgres(c);
      await datosFiscales(c, acme);

      await actAs(c, miembro);
      expect(await fallo(c, "select public.confirm_engagement_data($1)", [e])).toMatch(
        /propietario o facturación/,
      );
      await comoPostgres(c);
      await actAs(c, owner);
      await c.query("select public.confirm_engagement_data($1)", [e]);
      await c.query("select public.confirm_engagement_data($1)", [e]);
      const r = await c.query("select status from public.engagements where id = $1", [e]);
      expect(r.rows[0].status).toBe("datos_completos");
    });
  });
});

describe.skipIf(!db)("alta de cliente con invitación", () => {
  it("con y sin servicio, en una transacción; un cliente no puede", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const cliente = await createAuthUser(c, { email: "ana@acme.test" });
      await hacerStaff(c, staff);
      const { versionId } = await crearServicio(c, "Web");

      await actAs(c, staff);
      const con = await c.query(
        "select * from public.create_client_with_invitation('Con servicio', 'a@con.test', $1, 99000)",
        [versionId],
      );
      const sin = await c.query(
        "select * from public.create_client_with_invitation('Sin servicio', 'b@sin.test')",
      );
      expect(con.rows[0].token).toMatch(/^[0-9a-f]{64}$/);
      const e = await c.query(
        `select e.status, l.unit_price_cents from public.engagements e
           join public.engagement_lines l on l.revision_id = e.current_revision_id
          where e.organization_id = $1`,
        [con.rows[0].organization_id],
      );
      expect(e.rows).toEqual([{ status: "invitada", unit_price_cents: "99000" }]);
      const i = await c.query("select role from public.invitations where organization_id = $1", [
        sin.rows[0].organization_id,
      ]);
      expect(i.rows).toEqual([{ role: "owner" }]);

      await comoPostgres(c);
      await actAs(c, cliente);
      expect(
        await fallo(c, "select * from public.create_client_with_invitation('Colado', 'c@c.test')"),
      ).toMatch(/row-level security/);
    });
  });
});

describe.skipIf(!db)("ver como cliente", () => {
  it("queda registrado; un cliente no puede usarlo", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const cliente = await createAuthUser(c, { email: "ana@acme.test" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");

      await actAs(c, staff);
      await c.query("select public.log_client_view($1)", [acme]);
      const r = await c.query(
        "select actor_id from public.audit_log where organization_id = $1 and action = 'organization.viewed_as_client'",
        [acme],
      );
      expect(r.rows).toEqual([{ actor_id: staff }]);

      await comoPostgres(c);
      await actAs(c, cliente);
      expect(await fallo(c, "select public.log_client_view($1)", [acme])).toMatch(/Solo el equipo/);
    });
  });
});
