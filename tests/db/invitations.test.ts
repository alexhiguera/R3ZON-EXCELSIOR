import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  comoPostgres,
  crearOrganizacion,
  eventoAlta,
  fallo,
  hacerStaff,
  invitacionCaducada,
  invitar,
} from "./_excelsior";

/**
 * Alta solo por invitación (docs/AUTH.md → Previsto en Excelsior): el hook de
 * Supabase Auth, el alta automática, la aceptación con cuenta existente y las
 * transiciones de estado. Contra PostgreSQL real, sin mocks.
 */
describe.skipIf(!db)("invitaciones", () => {
  afterAll(async () => {
    await db?.end();
  });

  describe("creación", () => {
    it("solo el staff crea invitaciones; la base guarda el hash, nunca el token", async () => {
      await inRollback(async (c) => {
        const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
        const cliente = await createAuthUser(c, { email: "ana@acme.test" });
        await hacerStaff(c, staff);
        const acme = await crearOrganizacion(c, "Acme");

        await actAs(c, cliente);
        expect(
          await fallo(c, "select public.create_invitation($1, 'x@acme.test')", [acme]),
        ).toMatch(/row-level security/);

        await comoPostgres(c);
        await actAs(c, staff);
        const { rows } = await c.query(
          "select public.create_invitation($1, ' Nuevo@Acme.TEST ') as t",
          [acme],
        );
        const token: string = rows[0].t;
        expect(token).toMatch(/^[0-9a-f]{64}$/);

        const inv = await c.query(
          "select email, created_by, token_hash = extensions.digest($1, 'sha256') as hash_ok, position($1 in row_to_json(i)::text) as aparece from public.invitations i where organization_id = $2",
          [token, acme],
        );
        expect(inv.rows).toEqual([
          { email: "nuevo@acme.test", created_by: staff, hash_ok: true, aparece: 0 },
        ]);
      });
    });

    it("reenviar revoca la invitación abierta anterior", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        await invitar(c, acme, "ana@acme.test");
        const { rows } = await c.query(
          "select count(*) filter (where revoked_at is null)::int as abiertas, count(*)::int as total from public.invitations where organization_id = $1",
          [acme],
        );
        expect(rows[0]).toEqual({ abiertas: 1, total: 2 });
      });
    });

    it("un cliente no ve ninguna invitación, ni las de su empresa", async () => {
      await inRollback(async (c) => {
        const ana = await createAuthUser(c, { email: "ana@acme.test" });
        const acme = await crearOrganizacion(c, "Acme");
        await c.query(
          "insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')",
          [acme, ana],
        );
        await invitar(c, acme, "luis@acme.test", "member");

        await actAs(c, ana);
        const { rows } = await c.query("select count(*)::int as n from public.invitations");
        expect(rows[0].n).toBe(0);
      });
    });
  });

  describe("hook before_user_created", () => {
    const hook = "select public.hook_before_user_created($1::jsonb) as r";
    const RECHAZO = /invitación válida/;

    it("rechaza un alta con contraseña sin token", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        const { rows } = await c.query(hook, [eventoAlta("ana@acme.test", "email")]);
        expect(rows[0].r.error.http_code).toBe(403);
        expect(rows[0].r.error.message).toMatch(RECHAZO);
      });
    });

    it("acepta un alta con contraseña con el token de ESE email", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        const token = await invitar(c, acme, "ana@acme.test");
        const ok = await c.query(hook, [
          eventoAlta("Ana@Acme.test", "email", { invitation_token: token }),
        ]);
        expect(ok.rows[0].r).toEqual({});

        // El mismo token con otro email: no.
        const otro = await c.query(hook, [
          eventoAlta("intruso@otra.test", "email", { invitation_token: token }),
        ]);
        expect(otro.rows[0].r.error.message).toMatch(RECHAZO);
      });
    });

    it("rechaza tokens caducados, revocados o ya usados", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        const caducado = await invitacionCaducada(c, acme, "ana@acme.test");
        const revocado = await invitar(c, acme, "bea@acme.test");
        await c.query(
          "update public.invitations set revoked_at = now() where email = 'bea@acme.test'",
        );
        const usado = await invitar(c, acme, "luis@acme.test");
        await createAuthUser(c, { email: "luis@acme.test" });

        for (const [email, token] of [
          ["ana@acme.test", caducado],
          ["bea@acme.test", revocado],
          ["luis@acme.test", usado],
        ]) {
          const { rows } = await c.query(hook, [
            eventoAlta(email!, "email", { invitation_token: token }),
          ]);
          expect(rows[0].r.error?.message, email).toMatch(RECHAZO);
        }
      });
    });

    it("con Google basta una invitación pendiente para ese email", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        const ok = await c.query(hook, [eventoAlta("ana@acme.test", "google")]);
        expect(ok.rows[0].r).toEqual({});
        const no = await c.query(hook, [eventoAlta("desconocido@gmail.test", "google")]);
        expect(no.rows[0].r.error.message).toMatch(RECHAZO);
      });
    });

    it("rechaza cualquier otro proveedor y los emails vacíos", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        const otro = await c.query(hook, [eventoAlta("ana@acme.test", "github" as "google")]);
        expect(otro.rows[0].r.error.message).toMatch(RECHAZO);
        const vacio = await c.query(hook, [eventoAlta("", "google")]);
        expect(vacio.rows[0].r.error.message).toMatch(RECHAZO);
      });
    });

    it("solo lo puede ejecutar Supabase Auth", async () => {
      const { rows } = await db!.query(
        `select has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute') as auth,
                has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') as gotrue`,
      );
      expect(rows[0]).toEqual({ anon: false, auth: false, gotrue: true });
    });
  });

  describe("alta con invitación", () => {
    it("el alta acepta la invitación y crea la pertenencia con su rol, en la misma transacción", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test", "owner");
        const ana = await createAuthUser(c, { email: "Ana@Acme.test" });

        const m = await c.query(
          "select organization_id, role from public.organization_members where user_id = $1",
          [ana],
        );
        expect(m.rows).toEqual([{ organization_id: acme, role: "owner" }]);
        const inv = await c.query(
          "select accepted_by, accepted_at is not null as aceptada from public.invitations where organization_id = $1",
          [acme],
        );
        expect(inv.rows).toEqual([{ accepted_by: ana, aceptada: true }]);
        const audit = await c.query(
          "select actor_id from public.audit_log where action = 'invitation.accepted' and organization_id = $1",
          [acme],
        );
        expect(audit.rows).toEqual([{ actor_id: ana }]);
      });
    });

    it("no acepta invitaciones caducadas", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitacionCaducada(c, acme, "ana@acme.test");
        const ana = await createAuthUser(c, { email: "ana@acme.test" });
        const m = await c.query("select 1 from public.organization_members where user_id = $1", [
          ana,
        ]);
        expect(m.rowCount).toBe(0);
      });
    });

    it("el token no se guarda en los metadatos del usuario", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        const token = await invitar(c, acme, "ana@acme.test");
        const { rows } = await c.query(
          `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
           values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                   'ana@acme.test', $1::jsonb, now(), now())
           returning raw_user_meta_data as meta`,
          [JSON.stringify({ invitation_token: token, display_name: "Ana" })],
        );
        expect(rows[0].meta).toEqual({ display_name: "Ana" });
      });
    });

    it("ni aunque Auth lo escriba después, en un UPDATE o en auth.identities", async () => {
      await inRollback(async (c) => {
        const ana = await createAuthUser(c, { email: "ana@acme.test" });
        const token = "cd".repeat(32);
        const u = await c.query(
          `update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('invitation_token', $2::text)
            where id = $1 returning raw_user_meta_data ? 'invitation_token' as guardado`,
          [ana, token],
        );
        expect(u.rows[0].guardado).toBe(false);

        const i = await c.query(
          `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
           values ($1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'invitation_token', $2::text), 'email', now(), now())
           returning identity_data ? 'invitation_token' as guardado`,
          [ana, token],
        );
        expect(i.rows[0].guardado).toBe(false);
      });
    });
  });

  describe("aceptar con una cuenta que ya existe", () => {
    it("un usuario existente acepta una invitación de otra empresa (T-13)", async () => {
      await inRollback(async (c) => {
        const ana = await createAuthUser(c, { email: "ana@acme.test" });
        const otra = await crearOrganizacion(c, "Otra");
        const token = await invitar(c, otra, "ana@acme.test", "billing");

        await actAs(c, ana);
        const { rows } = await c.query("select public.accept_invitation($1) as org", [token]);
        expect(rows[0].org).toBe(otra);
        const m = await c.query(
          "select role from public.organization_members where organization_id = $1",
          [otra],
        );
        expect(m.rows).toEqual([{ role: "billing" }]);

        // Un solo uso.
        expect(await fallo(c, "select public.accept_invitation($1)", [token])).toMatch(
          /no es válida/,
        );
      });
    });

    it("no se puede aceptar la invitación de otro email", async () => {
      await inRollback(async (c) => {
        const intruso = await createAuthUser(c, { email: "intruso@otra.test" });
        const acme = await crearOrganizacion(c, "Acme");
        const token = await invitar(c, acme, "ana@acme.test");

        await actAs(c, intruso);
        expect(await fallo(c, "select public.accept_invitation($1)", [token])).toMatch(
          /otro email/,
        );
        await comoPostgres(c);
        const m = await c.query(
          "select count(*)::int as n from public.organization_members where organization_id = $1",
          [acme],
        );
        expect(m.rows[0].n).toBe(0);
      });
    });

    it("ni caducadas ni con un token inventado", async () => {
      await inRollback(async (c) => {
        const ana = await createAuthUser(c, { email: "ana@acme.test" });
        const acme = await crearOrganizacion(c, "Acme");
        const caducado = await invitacionCaducada(c, acme, "ana@acme.test");

        await actAs(c, ana);
        expect(await fallo(c, "select public.accept_invitation($1)", [caducado])).toMatch(
          /no es válida/,
        );
        expect(await fallo(c, "select public.accept_invitation($1)", ["00".repeat(32)])).toMatch(
          /no es válida/,
        );
      });
    });
  });

  describe("transiciones (ninguna vía se las salta)", () => {
    it("una invitación no se edita, y un desenlace es definitivo", async () => {
      await inRollback(async (c) => {
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        // Incluso como postgres (sin RLS): la regla está en el trigger.
        expect(
          await fallo(
            c,
            "update public.invitations set email = 'otro@acme.test' where organization_id = $1",
            [acme],
          ),
        ).toMatch(/no se modifica/);
        expect(
          await fallo(
            c,
            "update public.invitations set expires_at = now() + interval '1 year' where organization_id = $1",
            [acme],
          ),
        ).toMatch(/no se modifica/);
        await c.query(
          "update public.invitations set revoked_at = now() where organization_id = $1",
          [acme],
        );
        expect(
          await fallo(
            c,
            "update public.invitations set revoked_at = null where organization_id = $1",
            [acme],
          ),
        ).toMatch(/cerrada/);
      });
    });

    it("no se puede marcar como aceptada a mano por quien no es el invitado", async () => {
      await inRollback(async (c) => {
        const intruso = await createAuthUser(c, { email: "intruso@otra.test" });
        const acme = await crearOrganizacion(c, "Acme");
        await invitar(c, acme, "ana@acme.test");
        expect(
          await fallo(
            c,
            "update public.invitations set accepted_at = now(), accepted_by = $1 where organization_id = $2",
            [intruso, acme],
          ),
        ).toMatch(/otro email/);
      });
    });
  });
});
