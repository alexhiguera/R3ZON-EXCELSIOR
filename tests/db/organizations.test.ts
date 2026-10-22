import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import { comoPostgres, crearOrganizacion, fallo, hacerMiembro, hacerStaff } from "./_excelsior";

/**
 * Organizaciones, miembros, staff y registro de actividad contra PostgreSQL
 * real. La pregunta de fondo de todos: ¿puede un cliente ver o tocar algo de
 * otro cliente? (docs/ARCHITECTURE.md §16)
 */
describe.skipIf(!db)("organizaciones y miembros", () => {
  afterAll(async () => {
    await db?.end();
  });

  it("un cliente ve SOLO sus organizaciones y a sus compañeros", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const luis = await createAuthUser(c, { email: "luis@acme.test" });
      const bea = await createAuthUser(c, { email: "bea@otra.test" });
      const acme = await crearOrganizacion(c, "Acme");
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, acme, ana, "owner");
      await hacerMiembro(c, acme, luis);
      await hacerMiembro(c, otra, bea, "owner");

      await actAs(c, ana);
      const orgs = await c.query("select name from public.organizations order by name");
      expect(orgs.rows).toEqual([{ name: "Acme" }]);
      const miembros = await c.query("select user_id from public.organization_members");
      expect(miembros.rows.map((r) => r.user_id).sort()).toEqual([ana, luis].sort());
      const rol = await c.query("select public.org_role_of($1) as rol", [otra]);
      expect(rol.rows[0].rol).toBeNull();
    });
  });

  it("un usuario puede pertenecer a varias empresas (T-13)", async () => {
    await inRollback(async (c) => {
      const gestor = await createAuthUser(c, { email: "gestor@gestoria.test" });
      const a = await crearOrganizacion(c, "A");
      const b = await crearOrganizacion(c, "B");
      await hacerMiembro(c, a, gestor, "billing");
      await hacerMiembro(c, b, gestor, "owner");

      await actAs(c, gestor);
      const { rows } = await c.query("select name from public.organizations order by name");
      expect(rows).toEqual([{ name: "A" }, { name: "B" }]);
    });
  });

  it("el staff ve todas las organizaciones y todos los perfiles", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const cliente = await createAuthUser(c, { email: "cliente@acme.test" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");
      const otra = await crearOrganizacion(c, "Otra");

      await actAs(c, staff);
      const orgs = await c.query("select id from public.organizations where id = any($1)", [
        [acme, otra],
      ]);
      expect(orgs.rowCount).toBe(2);
      const perfiles = await c.query("select id from public.profiles where id = $1", [cliente]);
      expect(perfiles.rowCount).toBe(1);
    });
  });

  it("un cliente no puede crear organizaciones ni añadirse a una", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const otra = await crearOrganizacion(c, "Otra");

      await actAs(c, ana);
      expect(await fallo(c, "insert into public.organizations (name) values ('Mía')")).toMatch(
        /row-level security/,
      );
      expect(
        await fallo(
          c,
          "insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')",
          [otra, ana],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("nadie puede cambiarse su propio nivel de plataforma", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      await actAs(c, ana);
      expect(
        await fallo(c, "update public.profiles set platform_role = 'admin' where id = $1", [ana]),
      ).toMatch(/permission denied/);
    });
  });

  it("el staff crea organizaciones y created_by lo pone la base", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const otro = await createAuthUser(c, { email: "otro@r3zon.test" });
      await hacerStaff(c, staff);

      await actAs(c, staff);
      expect(
        await fallo(c, "insert into public.organizations (name, created_by) values ('X', $1)", [
          otro,
        ]),
      ).toMatch(/permission denied/);
      const { rows } = await c.query(
        "insert into public.organizations (name) values ('Nueva') returning created_by",
      );
      expect(rows[0].created_by).toBe(staff);
    });
  });

  it("una organización no se queda sin propietario", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const luis = await createAuthUser(c, { email: "luis@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");
      await hacerMiembro(c, acme, luis, "member");

      expect(
        await fallo(c, "delete from public.organization_members where user_id = $1", [ana]),
      ).toMatch(/sin propietario/);
      expect(
        await fallo(
          c,
          "update public.organization_members set role = 'member' where user_id = $1",
          [ana],
        ),
      ).toMatch(/sin propietario/);

      // Con otro propietario, sí.
      await c.query("update public.organization_members set role = 'owner' where user_id = $1", [
        luis,
      ]);
      await c.query("delete from public.organization_members where user_id = $1", [ana]);
      // Y borrar la organización entera arrastra a sus miembros sin protestar.
      await c.query("delete from public.organizations where id = $1", [acme]);
    });
  });

  it("registra la actividad y solo el staff la lee", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");

      await actAs(c, ana);
      const cliente = await c.query("select count(*)::int as n from public.audit_log");
      expect(cliente.rows[0].n).toBe(0);
      expect(
        await fallo(
          c,
          "insert into public.audit_log (action, details) values ('falso.evento', '{}')",
        ),
      ).toMatch(/permission denied/);

      await comoPostgres(c);
      await actAs(c, staff);
      const { rows } = await c.query(
        "select action from public.audit_log where organization_id = $1 order by created_at, id",
        [acme],
      );
      expect(rows.map((r) => r.action)).toEqual(["organization.created", "member.added"]);
    });
  });
});
