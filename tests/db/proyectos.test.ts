import { afterAll, describe, expect, it } from "vitest";
import { TRANSICIONES_PROYECTO } from "@/modulos/proyectos";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  comoPostgres,
  crearContratacion,
  crearOrganizacion,
  crearServicio,
  fallo,
  hacerMiembro,
  hacerStaff,
} from "./_excelsior";

/**
 * Módulo PROYECTOS contra PostgreSQL real: nacimiento del proyecto al
 * completar el alta (T-32), plantilla de briefing copiada, quién escribe qué
 * en el briefing, validación por tipo, máquina de estados y compartimentación.
 */
afterAll(async () => {
  await db?.end();
});

type C = Parameters<Parameters<typeof inRollback>[0]>[0];

/** Servicio con plantilla de briefing y contratación en «invitada». Todo como postgres. */
async function escenario(c: C, { firma = true } = {}) {
  const org = await crearOrganizacion(c, "Acme");
  const { serviceId, versionId } = await crearServicio(c, `Web ${Math.random()}`);
  for (const [section, kind, label, required] of [
    ["Marca", "color", "Color principal", true],
    ["Marca", "tipografia", "Tipografía", false],
    ["Contenido", "texto", "Sobre vosotros", true],
    ["Contenido", "enlace", "Web actual", false],
  ] as const) {
    await c.query(
      "insert into public.service_briefing_items (service_id, section, kind, label, required) values ($1, $2, $3, $4, $5)",
      [serviceId, section, kind, label, required],
    );
  }
  const e = await crearContratacion(c, org, versionId);
  await c.query(
    "update public.engagements set requires_signature = $2, status = 'invitada' where id = $1",
    [e, firma],
  );
  return { org, serviceId, e };
}

const proyectoDe = async (c: C, e: string) =>
  (await c.query("select id, name, status from public.projects where engagement_id = $1", [e]))
    .rows[0];

const elemento = async (c: C, proyecto: string, label: string) =>
  (
    await c.query(
      "select id, status, value, staff_note from public.project_briefing_items where project_id = $1 and label = $2",
      [proyecto, label],
    )
  ).rows[0];

async function conProyecto(c: C) {
  const s = await escenario(c, { firma: false });
  await c.query("update public.engagements set status = 'datos_completos' where id = $1", [s.e]);
  const p = await proyectoDe(c, s.e);
  const owner = await createAuthUser(c, { email: `owner-${Math.random()}@acme.test` });
  await hacerMiembro(c, s.org, owner, "owner");
  const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
  await hacerStaff(c, staff);
  return { ...s, proyecto: p.id as string, owner, staff };
}

const aportar = (c: C, id: string, valor: string) =>
  c.query(
    "update public.project_briefing_items set status = 'aportado', value = $2 where id = $1 returning value",
    [id, valor],
  );

describe.skipIf(!db)("proyectos: nacimiento (T-32)", () => {
  it("sin firma en el portal, nace al dar los datos, con la plantilla copiada en orden", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c, { firma: false });
      expect(await proyectoDe(c, e)).toBeUndefined();
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
      const p = await proyectoDe(c, e);
      expect(p.status).toBe("briefing");
      const { rows } = await c.query(
        "select position, section, label, status from public.project_briefing_items where project_id = $1 order by position",
        [p.id],
      );
      expect(rows.map((r) => r.label)).toEqual([
        "Color principal",
        "Tipografía",
        "Sobre vosotros",
        "Web actual",
      ]);
      expect(rows.every((r) => r.status === "pendiente")).toBe(true);
    });
  });

  it("con firma, no nace al dar los datos sino al firmar, y solo una vez", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
      expect(await proyectoDe(c, e)).toBeUndefined();
      await c.query("update public.engagements set status = 'firmada' where id = $1", [e]);
      expect(await proyectoDe(c, e)).toBeDefined();
      await c.query("update public.engagements set status = 'activa' where id = $1", [e]);
      const n = await c.query(
        "select count(*)::int as n from public.projects where engagement_id = $1",
        [e],
      );
      expect(n.rows[0].n).toBe(1);
    });
  });

  it("nace si R3ZON quita la firma a una contratación con los datos ya dados", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
      await c.query("update public.engagements set requires_signature = false where id = $1", [e]);
      expect(await proyectoDe(c, e)).toBeDefined();
    });
  });

  it("cambiar la plantilla después no toca el proyecto existente", async () => {
    await inRollback(async (c) => {
      const { serviceId, proyecto } = await conProyecto(c);
      await c.query("delete from public.service_briefing_items where service_id = $1", [serviceId]);
      const n = await c.query(
        "select count(*)::int as n from public.project_briefing_items where project_id = $1",
        [proyecto],
      );
      expect(n.rows[0].n).toBe(4);
    });
  });

  it("nadie crea proyectos a mano", async () => {
    await inRollback(async (c) => {
      const { org, e, staff } = await conProyecto(c);
      await actAs(c, staff);
      expect(
        await fallo(
          c,
          "insert into public.projects (organization_id, engagement_id, name) values ($1, $2, 'x')",
          [org, e],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe.skipIf(!db)("proyectos: briefing del cliente", () => {
  it("aporta un color (se guarda normalizado) y un enlace; rechaza lo que no encaja", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner } = await conProyecto(c);
      const color = await elemento(c, proyecto, "Color principal");
      const web = await elemento(c, proyecto, "Web actual");
      await actAs(c, owner);
      expect((await aportar(c, color.id, " #1A2B3C ")).rows[0].value).toBe("#1a2b3c");
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'aportado', value = 'rojo' where id = $1",
          [color.id],
        ),
      ).toMatch(/hexadecimal/);
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'aportado', value = 'javascript:alert(1)' where id = $1",
          [web.id],
        ),
      ).toMatch(/https:\/\//);
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'aportado', value = '  ' where id = $1",
          [web.id],
        ),
      ).toMatch(/Escribe tu respuesta/);
    });
  });

  it("«más tarde» vale para todo; «no aplica», solo para lo opcional", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner } = await conProyecto(c);
      const obligatorio = await elemento(c, proyecto, "Sobre vosotros");
      const opcional = await elemento(c, proyecto, "Tipografía");
      await actAs(c, owner);
      await c.query("update public.project_briefing_items set status = 'mas_tarde' where id = $1", [
        obligatorio.id,
      ]);
      await c.query("update public.project_briefing_items set status = 'no_aplica' where id = $1", [
        opcional.id,
      ]);
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'no_aplica' where id = $1",
          [obligatorio.id],
        ),
      ).toMatch(/obligatorio/);
    });
  });

  it("el cliente no valida, no escribe notas, ni toca lo ya validado", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner, staff } = await conProyecto(c);
      const texto = await elemento(c, proyecto, "Sobre vosotros");
      await actAs(c, owner);
      await aportar(c, texto.id, "Somos Acme.");
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'validado' where id = $1",
          [texto.id],
        ),
      ).toMatch(/no permitido/);
      expect(
        await fallo(c, "update public.project_briefing_items set staff_note = 'ok' where id = $1", [
          texto.id,
        ]),
      ).toMatch(/R3ZON/);

      await actAs(c, staff);
      await c.query("update public.project_briefing_items set status = 'validado' where id = $1", [
        texto.id,
      ]);
      await actAs(c, owner);
      expect(
        await fallo(c, "update public.project_briefing_items set value = 'Otra' where id = $1", [
          texto.id,
        ]),
      ).toMatch(/ya lo ha validado/);
    });
  });

  it("R3ZON pide cambios con nota; al volver a aportar, la nota se va", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner, staff } = await conProyecto(c);
      const texto = await elemento(c, proyecto, "Sobre vosotros");
      await actAs(c, owner);
      await aportar(c, texto.id, "Somos Acme.");

      await actAs(c, staff);
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'cambios' where id = $1",
          [texto.id],
        ),
      ).toMatch(/qué hay que cambiar/);
      await c.query(
        "update public.project_briefing_items set status = 'cambios', staff_note = 'Más largo, por favor.' where id = $1",
        [texto.id],
      );
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'validado' where id = $1",
          [texto.id],
        ),
      ).toMatch(/Solo se valida lo aportado/);

      await actAs(c, owner);
      await aportar(c, texto.id, "Somos Acme, desde 1990.");
      await comoPostgres(c);
      expect(await elemento(c, proyecto, "Sobre vosotros")).toMatchObject({
        status: "aportado",
        staff_note: null,
      });
    });
  });

  it("facturación lee pero no escribe; otra empresa ni lo ve", async () => {
    await inRollback(async (c) => {
      const { org, proyecto } = await conProyecto(c);
      const texto = await elemento(c, proyecto, "Sobre vosotros");
      const facturacion = await createAuthUser(c, { email: `fact-${Math.random()}@acme.test` });
      await hacerMiembro(c, org, facturacion, "billing");
      const ajeno = await createAuthUser(c, { email: `x-${Math.random()}@otra.test` });
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, otra, ajeno, "owner");

      await actAs(c, facturacion);
      expect(
        (await c.query("select 1 from public.project_briefing_items where id = $1", [texto.id]))
          .rowCount,
      ).toBe(1);
      expect((await aportar(c, texto.id, "Hola")).rowCount).toBe(0);

      await actAs(c, ajeno);
      expect(
        (await c.query("select 1 from public.projects where id = $1", [proyecto])).rowCount,
      ).toBe(0);
      expect(
        (
          await c.query("select 1 from public.project_briefing_items where project_id = $1", [
            proyecto,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await c.query("select 1 from public.project_briefing_progress where project_id = $1", [
            proyecto,
          ])
        ).rowCount,
      ).toBe(0);
    });
  });

  it("un miembro escribe; el registro guarda el cambio de estado sin el contenido", async () => {
    await inRollback(async (c) => {
      const { org, proyecto } = await conProyecto(c);
      const miembro = await createAuthUser(c, { email: `m-${Math.random()}@acme.test` });
      await hacerMiembro(c, org, miembro, "member");
      const texto = await elemento(c, proyecto, "Sobre vosotros");
      await actAs(c, miembro);
      expect((await aportar(c, texto.id, "Texto secreto de marca")).rowCount).toBe(1);
      await comoPostgres(c);
      const log = await c.query(
        "select details::text as d from public.audit_log where action = 'briefing.aportado' and organization_id = $1",
        [org],
      );
      expect(log.rowCount).toBe(1);
      expect(log.rows[0].d).not.toContain("secreto");
    });
  });

  it("el progreso cuenta los obligatorios aportados y lo que falta revisar", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner } = await conProyecto(c);
      await actAs(c, owner);
      await aportar(c, (await elemento(c, proyecto, "Color principal")).id, "#000000");
      await c.query("update public.project_briefing_items set status = 'no_aplica' where id = $1", [
        (await elemento(c, proyecto, "Web actual")).id,
      ]);
      const { rows } = await c.query(
        "select total, required_total, done, required_done, to_review from public.project_briefing_progress where project_id = $1",
        [proyecto],
      );
      expect(rows[0]).toEqual({
        total: 4,
        required_total: 2,
        done: 2,
        required_done: 1,
        to_review: 1,
      });
    });
  });
});

describe.skipIf(!db)("proyectos: estados y plantilla", () => {
  it("sigue su máquina de estados; el cliente no lo mueve; cancelado congela el briefing", async () => {
    await inRollback(async (c) => {
      const { proyecto, owner, staff } = await conProyecto(c);
      await actAs(c, owner);
      expect(
        (
          await c.query("update public.projects set status = 'diseno' where id = $1 returning id", [
            proyecto,
          ])
        ).rowCount,
      ).toBe(0);

      await actAs(c, staff);
      expect(
        await fallo(c, "update public.projects set status = 'lanzado' where id = $1", [proyecto]),
      ).toMatch(/no permitida/);
      await c.query("update public.projects set status = 'diseno' where id = $1", [proyecto]);
      await c.query("update public.projects set status = 'en_pausa' where id = $1", [proyecto]);
      await c.query("update public.projects set status = 'diseno' where id = $1", [proyecto]);
      await c.query("update public.projects set status = 'cancelado' where id = $1", [proyecto]);
      expect(
        await fallo(c, "update public.projects set status = 'diseno' where id = $1", [proyecto]),
      ).toMatch(/no permitida/);

      await actAs(c, owner);
      expect(
        await fallo(
          c,
          "update public.project_briefing_items set status = 'mas_tarde' where project_id = $1",
          [proyecto],
        ),
      ).toMatch(/cancelado/);
    });
  });

  it("la plantilla la edita admin, no staff ni clientes; la posición la pone la base", async () => {
    await inRollback(async (c) => {
      const { serviceId, staff, owner } = await conProyecto(c);
      const admin = await createAuthUser(c, { email: `admin-${Math.random()}@r3zon.test` });
      await hacerStaff(c, admin, "admin");
      const insertar =
        "insert into public.service_briefing_items (service_id, kind, label) values ($1, 'texto', 'Eslogan') returning position";

      await actAs(c, staff);
      expect(await fallo(c, insertar, [serviceId])).toMatch(/row-level security/);
      await actAs(c, owner);
      expect(await fallo(c, insertar, [serviceId])).toMatch(/row-level security|permission/);
      await actAs(c, admin);
      expect((await c.query(insertar, [serviceId])).rows[0].position).toBe(5);
    });
  });

  it("TRANSICIONES_PROYECTO (interfaz) coincide con project_transition_allowed", async () => {
    const { rows } = await db!.query<{ desde: string; hacia: string }>(
      `select a.e::text as desde, b.e::text as hacia
         from unnest(enum_range(null::public.project_status)) a(e)
        cross join unnest(enum_range(null::public.project_status)) b(e)
        where public.project_transition_allowed(a.e, b.e)`,
    );
    const enBase: Record<string, string[]> = {};
    for (const r of rows) enBase[r.desde] = [...(enBase[r.desde] ?? []), r.hacia];
    for (const [desde, hacia] of Object.entries(TRANSICIONES_PROYECTO)) {
      expect([...(enBase[desde] ?? [])].sort(), desde).toEqual([...hacia].sort());
    }
  });
});
