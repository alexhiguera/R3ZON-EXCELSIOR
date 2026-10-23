import { afterAll, describe, expect, it } from "vitest";
import { type Estado, TRANSICIONES } from "@/modulos/contrataciones";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  comoPostgres,
  crearContratacion,
  crearOrganizacion,
  crearServicio,
  fallo,
  hacerMiembro,
  hacerStaff,
  revisionDe,
} from "./_excelsior";

/**
 * Módulo CONTRATACIONES: máquina de estados, compartimentación por cliente,
 * invitación con servicio y conservación (no se borran ni se arrastran).
 */
afterAll(async () => {
  await db?.end();
});

describe.skipIf(!db)("contrataciones", () => {
  it("invite_to_service crea contratación e invitación enlazadas, en estado invitada", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");
      const { versionId } = await crearServicio(c, "Web", { precio: 150000 });

      await actAs(c, staff);
      const { rows } = await c.query(
        "select public.invite_to_service($1, 'ana@acme.test', $2, 120000, $3) as token",
        [acme, versionId, "  Descuento del 20 por ciento  "],
      );
      expect(rows[0].token).toMatch(/^[0-9a-f]{64}$/);
      const e = await c.query(
        `select e.status, r.conditions, r.total_cents, i.email, l.name, l.unit_price_cents, l.vat_rate
           from public.engagements e
           join public.invitations i on i.id = e.invitation_id
           join public.engagement_revisions r on r.id = e.current_revision_id
           join public.engagement_lines l on l.revision_id = r.id
          where e.organization_id = $1`,
        [acme],
      );
      // Una línea copiada del catálogo con el precio pactado; total con 21 % de IVA.
      expect(e.rows).toEqual([
        {
          status: "invitada",
          conditions: "Descuento del 20 por ciento",
          total_cents: "145200",
          email: "ana@acme.test",
          name: "Web",
          unit_price_cents: "120000",
          vat_rate: "21.00",
        },
      ]);
      const h = await c.query(
        `select h.from_status, h.to_status from public.engagement_status_history h
           join public.engagements e on e.id = h.engagement_id
          where e.organization_id = $1 order by h.changed_at, h.id`,
        [acme],
      );
      expect(h.rows).toEqual([
        { from_status: null, to_status: "borrador" },
        { from_status: "borrador", to_status: "invitada" },
      ]);
    });
  });

  it("un cliente no puede invitar ni crear contrataciones", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");
      const { versionId } = await crearServicio(c, "Web");
      await actAs(c, ana);
      // No ve el catálogo, así que ni siquiera encuentra el servicio.
      expect(
        await fallo(c, "select public.invite_to_service($1, 'x@acme.test', $2)", [acme, versionId]),
      ).toMatch(/no existe|row-level security/);
    });
  });

  it("solo se permiten las transiciones de la máquina de estados", async () => {
    await inRollback(async (c) => {
      const acme = await crearOrganizacion(c, "Acme");
      const { versionId } = await crearServicio(c, "Web");
      const id = await crearContratacion(c, acme, versionId);

      expect(
        await fallo(c, "update public.engagements set status = 'activa' where id = $1", [id]),
      ).toMatch(/Transición no permitida: borrador → activa/);
      const recorrido = ["invitada", "datos_completos", "firmada", "activa", "finalizada"];
      for (const estado of recorrido) {
        await c.query("update public.engagements set status = $2 where id = $1", [id, estado]);
      }
      expect(
        await fallo(c, "update public.engagements set status = 'activa' where id = $1", [id]),
      ).toMatch(/no permitida/);
    });
  });

  it("nace en borrador y sus condiciones se congelan al dar los datos", async () => {
    await inRollback(async (c) => {
      const acme = await crearOrganizacion(c, "Acme");
      const { versionId } = await crearServicio(c, "Web");
      expect(
        await fallo(
          c,
          "insert into public.engagements (organization_id, status) values ($1, 'activa')",
          [acme],
        ),
      ).toMatch(/nace en borrador/);
      const id = await crearContratacion(c, acme, versionId);
      const rev = await revisionDe(c, id);
      await c.query(
        "update public.engagement_lines set unit_price_cents = 99000 where revision_id = $1",
        [rev],
      );
      await c.query("update public.engagements set status = 'invitada' where id = $1", [id]);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [id]);
      const r = await c.query(
        "select status, total_cents from public.engagement_revisions where id = $1",
        [rev],
      );
      expect(r.rows[0]).toEqual({ status: "aceptada", total_cents: "119790" });
      expect(
        await fallo(
          c,
          "update public.engagement_lines set unit_price_cents = 1 where revision_id = $1",
          [rev],
        ),
      ).toMatch(/ya están propuestas o aceptadas/);
      expect(
        await fallo(c, "delete from public.engagement_lines where revision_id = $1", [rev]),
      ).toMatch(/ya están propuestas o aceptadas/);
    });
  });

  it("sin condiciones válidas no se invita ni se dan los datos", async () => {
    await inRollback(async (c) => {
      const acme = await crearOrganizacion(c, "Acme");
      const { rows } = await c.query(
        "insert into public.engagements (organization_id) values ($1) returning id",
        [acme],
      );
      expect(
        await fallo(c, "update public.engagements set status = 'invitada' where id = $1", [
          rows[0].id,
        ]),
      ).toMatch(/Faltan las condiciones económicas/);
    });
  });

  it("cada cliente ve SOLO sus contrataciones y sus líneas, no el catálogo", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, acme, ana, "owner");
      const web = await crearServicio(c, "Web");
      const tienda = await crearServicio(c, "Ecommerce");
      const mia = await crearContratacion(c, acme, web.versionId);
      const ajena = await crearContratacion(c, otra, tienda.versionId);

      await actAs(c, ana);
      const e = await c.query("select id from public.engagements where organization_id = any($1)", [
        [acme, otra],
      ]);
      expect(e.rows).toEqual([{ id: mia }]);
      // Las condiciones van copiadas en sus líneas: el catálogo no le hace falta.
      const l = await c.query(
        "select l.name from public.engagement_lines l join public.engagement_revisions r on r.id = l.revision_id where r.engagement_id = any($1)",
        [[mia, ajena]],
      );
      expect(l.rows).toEqual([{ name: "Web" }]);
      const s = await c.query("select 1 from public.services where id = any($1)", [
        [web.serviceId, tienda.serviceId],
      ]);
      expect(s.rowCount).toBe(0);
      const v = await c.query("select 1 from public.service_versions where id = any($1)", [
        [web.versionId, tienda.versionId],
      ]);
      expect(v.rowCount).toBe(0);
      const h = await c.query(
        "select distinct engagement_id from public.engagement_status_history where engagement_id = any($1)",
        [[mia, ajena]],
      );
      expect(h.rows).toEqual([{ engagement_id: mia }]);
    });
  });

  it("un cliente no puede cambiar el estado ni el precio de su contratación", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");
      const { versionId } = await crearServicio(c, "Web");
      const id = await crearContratacion(c, acme, versionId);
      const rev = await revisionDe(c, id);

      await actAs(c, ana);
      const r = await c.query("update public.engagements set status = 'invitada' where id = $1", [
        id,
      ]);
      expect(r.rowCount).toBe(0);
      const l = await c.query(
        "update public.engagement_lines set unit_price_cents = 0, discount_percent = 100 where revision_id = $1",
        [rev],
      );
      expect(l.rowCount).toBe(0);
      await comoPostgres(c);
      const { rows } = await c.query(
        "select e.status, r.total_cents from public.engagements e join public.engagement_revisions r on r.id = e.current_revision_id where e.id = $1",
        [id],
      );
      expect(rows).toEqual([{ status: "borrador", total_cents: "181500" }]);
    });
  });

  it("no se borran, ni se arrastran al borrar la organización; el historial es inmutable", async () => {
    await inRollback(async (c) => {
      const acme = await crearOrganizacion(c, "Acme");
      const { versionId } = await crearServicio(c, "Web");
      const id = await crearContratacion(c, acme, versionId);
      expect(await fallo(c, "delete from public.organizations where id = $1", [acme])).toMatch(
        /foreign key/,
      );
      expect(
        await fallo(c, "delete from public.engagement_status_history where engagement_id = $1", [
          id,
        ]),
      ).toMatch(/solo añadir/);
      const g = await c.query(
        "select has_table_privilege('authenticated', 'public.engagements', 'delete') as borrar",
      );
      expect(g.rows[0].borrar).toBe(false);
    });
  });

  it("cambiar de estado con motivo deja el motivo en el historial", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");
      const { versionId } = await crearServicio(c, "Web");
      const id = await crearContratacion(c, acme, versionId);
      await actAs(c, staff);
      await c.query(
        "select public.change_engagement_status($1, 'cancelada', 'El cliente no sigue')",
        [id],
      );
      const { rows } = await c.query(
        "select to_status, reason, changed_by from public.engagement_status_history where engagement_id = $1 and to_status = 'cancelada'",
        [id],
      );
      expect(rows).toEqual([
        { to_status: "cancelada", reason: "El cliente no sigue", changed_by: staff },
      ]);
    });
  });
});

describe.skipIf(!db)("transiciones: interfaz y base dicen lo mismo", () => {
  it("TRANSICIONES (src/modulos/contrataciones) coincide con engagement_transition_allowed", async () => {
    const { rows } = await db!.query<{ desde: Estado; hacia: Estado }>(
      `select a.e::text as desde, b.e::text as hacia
         from unnest(enum_range(null::public.engagement_status)) a(e)
        cross join unnest(enum_range(null::public.engagement_status)) b(e)
        where public.engagement_transition_allowed(a.e, b.e)`,
    );
    const enBase: Record<string, string[]> = {};
    for (const r of rows) {
      enBase[r.desde] = [...(enBase[r.desde] ?? []), r.hacia];
    }
    for (const [desde, hacia] of Object.entries(TRANSICIONES)) {
      expect([...(enBase[desde] ?? [])].sort(), desde).toEqual([...hacia].sort());
    }
  });
});

describe.skipIf(!db)("directorio de miembros", () => {
  it("el staff ve los emails de los miembros; un cliente no puede consultarlo", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: "equipo@r3zon.test" });
      const ana = await createAuthUser(c, { email: "ana@acme.test", displayName: "Ana" });
      await hacerStaff(c, staff);
      const acme = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, acme, ana, "owner");

      await actAs(c, staff);
      const { rows } = await c.query(
        "select display_name, email, role from public.organization_directory($1)",
        [acme],
      );
      expect(rows).toEqual([{ display_name: "Ana", email: "ana@acme.test", role: "owner" }]);

      await comoPostgres(c);
      await actAs(c, ana);
      expect(await fallo(c, "select * from public.organization_directory($1)", [acme])).toMatch(
        /Solo el equipo/,
      );
    });
  });
});
