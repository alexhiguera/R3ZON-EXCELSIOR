import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  comoPostgres,
  crearOrganizacion,
  fallo,
  hacerMiembro,
  hacerStaff,
  invitar,
} from "./_excelsior";

/**
 * Módulo PLATAFORMA: niveles del equipo y registro de actividad. El registro es
 * evidencia (6 años, docs/RGPD.md): tiene que ser inmutable para todos y no
 * puede guardar datos personales directos.
 */
afterAll(async () => {
  await db?.end();
});

describe.skipIf(!db)("plataforma: registro de actividad", () => {
  it("es de solo añadir: ni postgres puede modificarlo, borrarlo ni vaciarlo", async () => {
    await inRollback(async (c) => {
      const acme = await crearOrganizacion(c, "Acme");
      const filtro = [acme];
      expect(
        await fallo(
          c,
          "update public.audit_log set action = 'x.y' where organization_id = $1",
          filtro,
        ),
      ).toMatch(/solo añadir/);
      expect(
        await fallo(c, "delete from public.audit_log where organization_id = $1", filtro),
      ).toMatch(/solo añadir/);
      expect(await fallo(c, "truncate public.audit_log")).toMatch(/solo añadir/);
    });
  });

  it("la purga solo acepta registros de más de 6 años y solo la ejecuta service_role", async () => {
    await inRollback(async (c) => {
      expect(await fallo(c, "select public.audit_log_purge(now() - interval '5 years')")).toMatch(
        /más de 6 años/,
      );
      const { rows } = await c.query(
        "select public.audit_log_purge(now() - interval '6 years 1 day')::int as n",
      );
      expect(rows[0].n).toBeGreaterThanOrEqual(0);

      const permisos = await c.query(
        `select has_function_privilege('authenticated', 'public.audit_log_purge(timestamptz)', 'execute') as auth,
                has_function_privilege('service_role', 'public.audit_log_purge(timestamptz)', 'execute') as service`,
      );
      expect(permisos.rows[0]).toEqual({ auth: false, service: true });
    });
  });

  it("no guarda emails, nombres ni tokens", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, {
        email: "equipo@r3zon.test",
        displayName: "Eva Equipo",
      });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme Secreta");
      const token = await invitar(c, acme, "ana.privada@acme.test");
      const ana = await createAuthUser(c, {
        email: "ana.privada@acme.test",
        displayName: "Ana Privada",
      });
      await c.query("update public.profiles set platform_role = 'staff' where id = $1", [ana]);

      const { rows } = await c.query<{ texto: string }>(
        "select string_agg(details::text, ' ') as texto from public.audit_log where organization_id = $1 or details->>'user_id' = $2",
        [acme, ana],
      );
      const texto = rows[0]!.texto;
      expect(texto).toContain(ana); // ids sí
      for (const prohibido of ["ana.privada", "Ana Privada", "Acme Secreta", token, "Eva"]) {
        expect(texto, prohibido).not.toContain(prohibido);
      }
    });
  });

  it("el actor se conserva seudonimizado aunque se borre al usuario", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      await hacerStaff(c, staff);
      await actAs(c, staff);
      const { rows } = await c.query(
        "insert into public.organizations (name) values ('Nueva') returning id",
      );
      const org = rows[0].id;

      await comoPostgres(c);
      await c.query("delete from auth.users where id = $1", [staff]);
      const audit = await c.query(
        "select actor_id from public.audit_log where organization_id = $1 and action = 'organization.created'",
        [org],
      );
      expect(audit.rows).toEqual([{ actor_id: staff }]);
      const persona = await c.query("select 1 from auth.users where id = $1", [staff]);
      expect(persona.rowCount).toBe(0);
    });
  });

  it("un cambio de nivel queda registrado; un cliente no lee el registro", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");
      await hacerStaff(c, ana, "admin");
      const { rows } = await c.query(
        "select details->>'to' as nivel from public.audit_log where action = 'profile.platform_role_changed' and details->>'user_id' = $1",
        [ana],
      );
      expect(rows).toEqual([{ nivel: "admin" }]);

      await c.query("update public.profiles set platform_role = 'client' where id = $1", [ana]);
      await actAs(c, ana);
      const visible = await c.query("select count(*)::int as n from public.audit_log");
      expect(visible.rows[0].n).toBe(0);
    });
  });
});

describe.skipIf(!db)("plataforma: minimización de invitaciones", () => {
  it("las invitaciones cerradas se purgan pasado el plazo, y no antes de 90 días", async () => {
    await inRollback(async (c) => {
      expect(await fallo(c, "select public.invitations_purge(now() - interval '30 days')")).toMatch(
        /90 días/,
      );
      const acme = await crearOrganizacion(c, "Acme");
      await c.query(
        `insert into public.invitations (organization_id, email, role, token_hash, created_at, expires_at)
         values ($1, 'vieja@acme.test', 'owner', extensions.digest('vieja', 'sha256'),
                 now() - interval '200 days', now() - interval '193 days')`,
        [acme],
      );
      await invitar(c, acme, "vigente@acme.test");
      await c.query("select public.invitations_purge(now() - interval '90 days')");
      const { rows } = await c.query(
        "select email from public.invitations where organization_id = $1 order by email",
        [acme],
      );
      expect(rows).toEqual([{ email: "vigente@acme.test" }]);
    });
  });
});
