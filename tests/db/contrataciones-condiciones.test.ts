import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  anadirLinea,
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
 * Condiciones económicas de una contratación contra PostgreSQL real: céntimos
 * enteros, una sola política de redondeo (docs/ARCHITECTURE.md §18),
 * descuentos, IVA por tipo, hitos, pagos parciales, revisiones y que el
 * cliente no pueda tocar nada de esto.
 */
afterAll(async () => {
  await db?.end();
});

type C = Parameters<Parameters<typeof inRollback>[0]>[0];

/** Contratación en borrador SIN líneas (como postgres). */
async function vacia(c: C) {
  const org = await crearOrganizacion(c, `Acme ${Math.random()}`);
  const { rows } = await c.query<{ id: string }>(
    "insert into public.engagements (organization_id) values ($1) returning id",
    [org],
  );
  const e = rows[0]!.id;
  return { org, e, rev: await revisionDe(c, e) };
}

async function totales(c: C, rev: string) {
  const { rows } = await c.query(
    `select subtotal_cents::bigint::text as subtotal, discount_cents::text as descuento, base_cents::text as base,
            vat_cents::text as iva, total_cents::text as total, taxes, milestones_valid as hitos_ok
       from public.engagement_revisions where id = $1`,
    [rev],
  );
  return rows[0];
}

const hitos = async (c: C, rev: string) =>
  (
    await c.query(
      "select amount_cents::text as x from public.engagement_milestones where revision_id = $1 order by position",
      [rev],
    )
  ).rows.map((r) => r.x);

const hito = (c: C, rev: string, label: string, opciones: { fijo?: number; peso?: number }) =>
  c.query(
    "insert into public.engagement_milestones (revision_id, label, fixed_cents, weight) values ($1, $2, $3, $4)",
    [rev, label, opciones.fijo ?? null, opciones.peso ?? null],
  );

describe.skipIf(!db)("dinero: la política de redondeo", () => {
  it("1.000 € en tres pagos: 333,33 + 333,33 + 333,34, sin perder un céntimo", async () => {
    const { rows } = await db!.query("select public.money_split(100000, array[1,1,1]) as p");
    expect(rows[0].p).toEqual(["33333", "33333", "33334"]);
  });

  it("reparte por pesos y da los céntimos sobrantes a las últimas partes", async () => {
    const casos: [number, number[], string[]][] = [
      [100000, [30, 70], ["30000", "70000"]],
      [100, [1, 1, 1], ["33", "33", "34"]],
      [101, [1, 1, 1], ["33", "34", "34"]],
      [1, [1, 1, 1], ["0", "0", "1"]],
      [0, [1, 2], ["0", "0"]],
      [
        99999999999,
        [1, 1, 1, 1, 1, 1, 1],
        [
          "14285714285",
          "14285714285",
          "14285714285",
          "14285714286",
          "14285714286",
          "14285714286",
          "14285714286",
        ],
      ],
    ];
    for (const [total, pesos, esperado] of casos) {
      const { rows } = await db!.query("select public.money_split($1, $2) as p", [total, pesos]);
      expect(rows[0].p, `${total} en ${pesos}`).toEqual(esperado);
      expect(rows[0].p.reduce((a: bigint, x: string) => a + BigInt(x), 0n)).toBe(BigInt(total));
    }
  });

  it("un reparto con pesos no positivos o un total negativo no se hace", async () => {
    await inRollback(async (c) => {
      expect(await fallo(c, "select public.money_split(100, array[1, 0])")).toMatch(/positivos/);
      expect(await fallo(c, "select public.money_split(-1, array[1])")).toMatch(/negativo/);
    });
  });

  it("un porcentaje redondea una sola vez, medio céntimo hacia arriba, en decimal exacto", async () => {
    const casos: [number, string, string][] = [
      [150000, "21", "31500"],
      [1050, "21", "221"], // 220,5 → 221
      [1049, "21", "220"], // 220,29 → 220
      [10, "10", "1"],
      [5, "10", "1"], // 0,5 → 1
      [4, "10", "0"],
      [33333, "21", "7000"], // 6999,93 → 7000
      [100000000000, "21", "21000000000"],
      [1, "0.01", "0"],
    ];
    for (const [centimos, tipo, esperado] of casos) {
      const { rows } = await db!.query("select public.money_percent($1, $2)::text as x", [
        centimos,
        tipo,
      ]);
      expect(rows[0].x, `${tipo} % de ${centimos}`).toBe(esperado);
    }
  });

  it("formatea céntimos en euros con separador de miles, sin decimales binarios", async () => {
    const casos: [number, string][] = [
      [0, "0,00 €"],
      [1050, "10,50 €"],
      [150000, "1.500,00 €"],
      [181500, "1.815,00 €"],
      [99999999999, "999.999.999,99 €"],
    ];
    for (const [centimos, texto] of casos) {
      const { rows } = await db!.query("select public.format_eur($1) as t", [centimos]);
      expect(rows[0].t).toBe(texto);
    }
  });
});

describe.skipIf(!db)("condiciones: líneas, descuentos e IVA", () => {
  it("1.500,00 € al 21 %: base 150000, IVA 31500, total 181500", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      await anadirLinea(c, rev, { precio: 150000 });
      expect(await totales(c, rev)).toMatchObject({
        base: "150000",
        iva: "31500",
        total: "181500",
        taxes: [{ rate: 21, base_cents: 150000, vat_cents: 31500 }],
      });
    });
  });

  it("el IVA se calcula una vez por tipo sobre la suma de bases, no línea a línea", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      // Por línea serían 220,5 → 221 dos veces = 442. Por tipo: 21 % de 21,00 € = 441.
      await anadirLinea(c, rev, { nombre: "A", precio: 1050 });
      await anadirLinea(c, rev, { nombre: "B", precio: 1050 });
      expect(await totales(c, rev)).toMatchObject({ base: "2100", iva: "441", total: "2541" });
    });
  });

  it("varios tipos de IVA: desglose por tipo y total = bases + cuotas", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      await anadirLinea(c, rev, { nombre: "Web", precio: 100000, iva: "21" });
      await anadirLinea(c, rev, { nombre: "Formación", precio: 33333, iva: "10" });
      await anadirLinea(c, rev, { nombre: "Exenta", precio: 5000, iva: "0" });
      const t = await totales(c, rev);
      expect(t).toMatchObject({ base: "138333", iva: "24333", total: "162666" });
      expect(t.taxes).toEqual([
        { rate: 21, base_cents: 100000, vat_cents: 21000 },
        { rate: 10, base_cents: 33333, vat_cents: 3333 },
        { rate: 0, base_cents: 5000, vat_cents: 0 },
      ]);
    });
  });

  it("descuentos: en % con un redondeo, en importe, y nunca dos ni por encima del precio", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      const pct = await anadirLinea(c, rev, { precio: 1050, descuentoPorcentaje: "15" });
      const imp = await anadirLinea(c, rev, { precio: 100000, descuentoImporte: 12345 });
      const { rows } = await c.query(
        "select id, discount_cents::text as d, base_cents::text as b from public.engagement_lines where revision_id = $1",
        [rev],
      );
      const por = Object.fromEntries(rows.map((r) => [r.id, { d: r.d, b: r.b }]));
      expect(por[pct]).toEqual({ d: "158", b: "892" }); // 157,5 → 158
      expect(por[imp]).toEqual({ d: "12345", b: "87655" });
      expect(await totales(c, rev)).toMatchObject({
        subtotal: "101050",
        descuento: "12503",
        base: "88547",
      });

      expect(
        await fallo(c, "update public.engagement_lines set discount_percent = 10 where id = $1", [
          imp,
        ]),
      ).toMatch(/porcentaje o en importe|one_discount/);
      expect(
        await fallo(
          c,
          "update public.engagement_lines set discount_amount_cents = 100001 where id = $1",
          [imp],
        ),
      ).toMatch(/no puede superar el precio/);
    });
  });

  it("rechaza importes negativos, IVA fuera de rango e importes desorbitados", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      for (const [precio, iva] of [
        [-1, "21"],
        [100, "-1"],
        [100, "100.01"],
        [100000000001, "21"],
      ] as const) {
        expect(
          await fallo(
            c,
            "insert into public.engagement_lines (revision_id, category_id, name, unit_price_cents, vat_rate) select $1, id, 'X', $2, $3 from public.service_categories limit 1",
            [rev, precio, iva],
          ),
        ).toMatch(/negativo|violates check constraint|numeric field overflow/);
      }
    });
  });

  it("importes elevados: sin desbordes ni pérdida de precisión", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      await anadirLinea(c, rev, { precio: 100000000000 }); // 1.000.000.000,00 €
      await anadirLinea(c, rev, { precio: 99999999999, descuentoPorcentaje: "33.33" });
      expect(await totales(c, rev)).toMatchObject({
        subtotal: "199999999999",
        descuento: "33330000000", // 33,33 % de 99999999999 = 33329999999,67 → 33330000000
        base: "166669999999",
        iva: "35000700000", // 21 % de 166669999999 = 35000699999,79 → 35000700000
        total: "201670699999",
      });
    });
  });
});

describe.skipIf(!db)("condiciones: hitos y lo exigible", () => {
  it("tres hitos iguales de 1.000 €: 333,33 + 333,33 + 333,34 y la suma es el total", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      await anadirLinea(c, rev, { precio: 100000, iva: "0" });
      for (const n of [1, 2, 3]) await hito(c, rev, `Pago ${n}`, { peso: 1 });
      expect(await hitos(c, rev)).toEqual(["33333", "33333", "33334"]);
      expect(await totales(c, rev)).toMatchObject({ total: "100000", hitos_ok: true });
    });
  });

  it("un importe fijo primero y el resto por pesos; se recalcula al cambiar las líneas", async () => {
    await inRollback(async (c) => {
      const { rev } = await vacia(c);
      const linea = await anadirLinea(c, rev, { precio: 100000 }); // 1.210,00 €
      await hito(c, rev, "Anticipo", { fijo: 50000 });
      await hito(c, rev, "Diseño", { peso: 1 });
      await hito(c, rev, "Entrega", { peso: 1 });
      expect(await hitos(c, rev)).toEqual(["50000", "35500", "35500"]);
      await c.query("update public.engagement_lines set unit_price_cents = 100001 where id = $1", [
        linea,
      ]);
      // 1210,01 €: el céntimo de más va al último hito.
      expect(await hitos(c, rev)).toEqual(["50000", "35500", "35501"]);
    });
  });

  it("hitos que no suman el total dejan las condiciones inválidas y no se puede invitar", async () => {
    await inRollback(async (c) => {
      const { e, rev } = await vacia(c);
      await anadirLinea(c, rev, { precio: 100000, iva: "0" });
      await hito(c, rev, "Único", { fijo: 90000 });
      expect((await totales(c, rev)).hitos_ok).toBe(false);
      expect(
        await fallo(c, "update public.engagements set status = 'invitada' where id = $1", [e]),
      ).toMatch(/hitos que sumen el total/);
      await c.query(
        "update public.engagement_milestones set fixed_cents = 100000 where revision_id = $1",
        [rev],
      );
      expect((await totales(c, rev)).hitos_ok).toBe(true);
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);
    });
  });

  it("pagos parciales por hitos liberados: lo exigible y el saldo cuadran al céntimo", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
      await hacerStaff(c, staff);
      const { e, rev } = await vacia(c);
      await anadirLinea(c, rev, { precio: 100000, iva: "0" });
      for (const n of [1, 2, 3]) await hito(c, rev, `Pago ${n}`, { peso: 1 });
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);

      const estado = async () =>
        (
          await c.query(
            "select status, paid_cents::text as pagado, balance_cents::text as saldo, public.amount_due_now($1)::text as exigible from public.engagement_collections where engagement_id = $1",
            [e],
          )
        ).rows[0];
      const cobrar = (importe: number) =>
        c.query(
          "insert into public.payments (engagement_id, amount_cents, method, paid_on) values ($1, $2, 'transferencia', current_date)",
          [e, importe],
        );
      const liberar = () =>
        c.query(
          "update public.engagements set released_milestones = released_milestones + 1 where id = $1",
          [e],
        );

      await actAs(c, staff);
      expect(await estado()).toEqual({
        status: "no_pagado",
        pagado: "0",
        saldo: "100000",
        exigible: "33333",
      });
      await cobrar(33333);
      expect(await estado()).toMatchObject({ status: "parcialmente_pagado", exigible: "0" });
      await liberar();
      expect(await estado()).toMatchObject({ exigible: "33333", saldo: "66667" });
      await cobrar(20000);
      expect(await estado()).toMatchObject({ exigible: "13333", saldo: "46667" });
      await liberar();
      expect(await estado()).toMatchObject({ exigible: "46667", saldo: "46667" });
      expect(
        await fallo(c, "update public.engagements set released_milestones = 4 where id = $1", [e]),
      ).toMatch(/No quedan hitos/);
      await cobrar(46667);
      expect(await estado()).toEqual({
        status: "pagado",
        pagado: "100000",
        saldo: "0",
        exigible: "0",
      });
      // Ni un céntimo más.
      expect(
        await fallo(
          c,
          "insert into public.payments (engagement_id, amount_cents, method, paid_on) values ($1, 1, 'transferencia', current_date)",
          [e],
        ),
      ).toMatch(/superaría el total/);
    });
  });

  it("los hitos se liberan de uno en uno, nunca hacia atrás, y no los libera el cliente", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: `ana-${Math.random()}@acme.test` });
      const { org, e, rev } = await vacia(c);
      await hacerMiembro(c, org, ana, "owner");
      await anadirLinea(c, rev, { precio: 100000, iva: "0" });
      for (const n of [1, 2, 3]) await hito(c, rev, `Pago ${n}`, { peso: 1 });
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);
      expect(
        await fallo(c, "update public.engagements set released_milestones = 2 where id = $1", [e]),
      ).toMatch(/No se puede liberar un hito en estado invitada/);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
      expect(
        await fallo(c, "update public.engagements set released_milestones = 3 where id = $1", [e]),
      ).toMatch(/de uno en uno/);
      await c.query("update public.engagements set released_milestones = 2 where id = $1", [e]);
      expect(
        await fallo(c, "update public.engagements set released_milestones = 1 where id = $1", [e]),
      ).toMatch(/de uno en uno/);

      await actAs(c, ana);
      const r = await c.query(
        "update public.engagements set released_milestones = 3 where id = $1 returning id",
        [e],
      );
      expect(r.rowCount).toBe(0);
    });
  });
});

describe.skipIf(!db)("condiciones: el cliente no las toca", () => {
  it("no crea, cambia ni borra líneas, hitos ni revisiones, ni llama a las funciones del equipo", async () => {
    await inRollback(async (c) => {
      const ana = await createAuthUser(c, { email: `ana-${Math.random()}@acme.test` });
      const org = await crearOrganizacion(c, "Acme");
      await hacerMiembro(c, org, ana, "owner");
      const { versionId } = await crearServicio(c, `Web ${Math.random()}`);
      const e = await crearContratacion(c, org, versionId);
      const rev = await revisionDe(c, e);
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);

      await actAs(c, ana);
      // Ve sus condiciones (las de la bienvenida)…
      expect(
        (await c.query("select 1 from public.engagement_lines where revision_id = $1", [rev]))
          .rowCount,
      ).toBe(1);
      // …pero no las cambia por ninguna vía.
      for (const sql of [
        "update public.engagement_lines set unit_price_cents = 1 where revision_id = $1",
        "update public.engagement_lines set discount_percent = 100 where revision_id = $1",
        "delete from public.engagement_lines where revision_id = $1",
        "update public.engagement_revisions set conditions = 'Gratis' where id = $1",
      ]) {
        expect((await c.query(`${sql} returning 1`, [rev])).rowCount, sql).toBe(0);
      }
      expect(
        await fallo(
          c,
          "insert into public.engagement_lines (revision_id, category_id, name, unit_price_cents, vat_rate) select $1, id, 'Regalo', 0, 0 from public.service_categories limit 1",
          [rev],
        ),
      ).toMatch(/row-level security/);
      expect(
        await fallo(
          c,
          "insert into public.engagement_milestones (revision_id, label, weight) values ($1, 'x', 1)",
          [rev],
        ),
      ).toMatch(/row-level security/);
      // Los totales no tienen permiso de escritura para nadie.
      expect(
        await fallo(c, "update public.engagement_revisions set total_cents = 0 where id = $1", [
          rev,
        ]),
      ).toMatch(/permission denied/);
      expect(await fallo(c, "select public.add_catalog_line($1, $2, 1)", [rev, versionId])).toMatch(
        /no existe|row-level security/,
      );

      await comoPostgres(c);
      expect(await totales(c, rev)).toMatchObject({ total: "181500" });
    });
  });

  it("el equipo tampoco escribe los importes calculados ni acepta por el cliente", async () => {
    await inRollback(async (c) => {
      const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
      await hacerStaff(c, staff);
      const { rev } = await vacia(c);
      await actAs(c, staff);
      const linea = await anadirLinea(c, rev, { precio: 1000 });
      expect(
        await fallo(c, "update public.engagement_lines set base_cents = 1 where id = $1", [linea]),
      ).toMatch(/permission denied/);
      expect(
        await fallo(c, "update public.engagement_revisions set status = 'aceptada' where id = $1", [
          rev,
        ]),
      ).toMatch(/las acepta el cliente/);
    });
  });
});

describe.skipIf(!db)("condiciones: revisiones", () => {
  /** Contratación con condiciones aceptadas (datos dados), staff y cliente de facturación. */
  async function aceptada(c: C) {
    const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
    await hacerStaff(c, staff);
    const cliente = await createAuthUser(c, { email: `fact-${Math.random()}@acme.test` });
    const org = await crearOrganizacion(c, "Acme");
    await hacerMiembro(c, org, cliente, "billing");
    const { serviceId, versionId } = await crearServicio(c, `Web ${Math.random()}`);
    const e = await crearContratacion(c, org, versionId, 100000);
    const rev1 = await revisionDe(c, e);
    await c.query(
      "update public.engagements set requires_signature = false, status = 'invitada' where id = $1",
      [e],
    );
    await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
    return { staff, cliente, org, serviceId, e, rev1 };
  }

  it("un cambio es una revisión nueva: copia, se edita, se propone y la acepta el cliente", async () => {
    await inRollback(async (c) => {
      const { staff, cliente, e, rev1 } = await aceptada(c);

      await actAs(c, staff);
      expect(
        await fallo(c, "insert into public.engagement_revisions (engagement_id) values ($1)", [e]),
      ).toMatch(/por qué cambian/);
      const rev2 = (
        await c.query(
          "insert into public.engagement_revisions (engagement_id, reason) values ($1, 'Amplía el alcance') returning id, number",
          [e],
        )
      ).rows[0];
      expect(rev2.number).toBe(2);
      // Copia de la vigente, editable.
      await c.query(
        "update public.engagement_lines set unit_price_cents = 120000 where revision_id = $1",
        [rev2.id],
      );
      expect(
        await fallo(
          c,
          "insert into public.engagement_revisions (engagement_id, reason) values ($1, 'Otro')",
          [e],
        ),
      ).toMatch(/duplicate key|one_open/);

      // El cliente no ve el cambio mientras se prepara; sí cuando se propone.
      await actAs(c, cliente);
      expect(
        (await c.query("select 1 from public.engagement_revisions where id = $1", [rev2.id]))
          .rowCount,
      ).toBe(0);
      await actAs(c, staff);
      await c.query("update public.engagement_revisions set status = 'propuesta' where id = $1", [
        rev2.id,
      ]);
      await actAs(c, cliente);
      expect(
        (await c.query("select 1 from public.engagement_revisions where id = $1", [rev2.id]))
          .rowCount,
      ).toBe(1);

      await c.query("select public.accept_engagement_revision($1)", [rev2.id]);
      await comoPostgres(c);
      const { rows } = await c.query(
        `select r.number, r.status, r.total_cents::text as total, (e.current_revision_id = r.id) as vigente
           from public.engagement_revisions r join public.engagements e on e.id = r.engagement_id
          where r.engagement_id = $1 order by r.number`,
        [e],
      );
      // La anterior no se recalcula: conserva su total.
      expect(rows).toEqual([
        { number: 1, status: "sustituida", total: "121000", vigente: false },
        { number: 2, status: "aceptada", total: "145200", vigente: true },
      ]);
      expect(rev1).toBeDefined();
      const log = await c.query(
        "select action from public.audit_log where details ->> 'engagement_id' = $1 and action like 'revision.%' order by created_at",
        [e],
      );
      expect(log.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining([
          "revision.created",
          "revision.propuesta",
          "revision.aceptada",
          "revision.sustituida",
        ]),
      );
    });
  });

  it("lo aceptado no cambia aunque cambie el catálogo o las tarifas", async () => {
    await inRollback(async (c) => {
      const { serviceId, rev1 } = await aceptada(c);
      await c.query(
        "insert into public.service_versions (service_id, price_cents, vat_rate) values ($1, 999999, 10)",
        [serviceId],
      );
      expect(await totales(c, rev1)).toMatchObject({ total: "121000", iva: "21000" });
    });
  });

  it("el cliente no acepta lo que no se le ha propuesto, ni lo hace un miembro sin permiso", async () => {
    await inRollback(async (c) => {
      const { staff, org, e } = await aceptada(c);
      const miembro = await createAuthUser(c, { email: `m-${Math.random()}@acme.test` });
      await hacerMiembro(c, org, miembro, "member");
      await actAs(c, staff);
      const rev2 = (
        await c.query(
          "insert into public.engagement_revisions (engagement_id, reason) values ($1, 'Cambio') returning id",
          [e],
        )
      ).rows[0].id;
      await comoPostgres(c);
      const dueno = await createAuthUser(c, { email: `o-${Math.random()}@acme.test` });
      await hacerMiembro(c, org, dueno, "owner");
      await actAs(c, dueno);
      expect(await fallo(c, "select public.accept_engagement_revision($1)", [rev2])).toMatch(
        /no existe|pendiente de aceptar/,
      );
      await actAs(c, staff);
      await c.query("update public.engagement_revisions set status = 'propuesta' where id = $1", [
        rev2,
      ]);
      await actAs(c, miembro);
      expect(await fallo(c, "select public.accept_engagement_revision($1)", [rev2])).toMatch(
        /Solo el propietario o facturación/,
      );
      // R3ZON puede retirarla o descartarla; descartada, ya no se acepta.
      await actAs(c, staff);
      await c.query("update public.engagement_revisions set status = 'descartada' where id = $1", [
        rev2,
      ]);
      await actAs(c, dueno);
      expect(await fallo(c, "select public.accept_engagement_revision($1)", [rev2])).toMatch(
        /pendiente de aceptar|no existe/,
      );
    });
  });

  it("si un cambio deja el total por debajo de lo cobrado, el cobro pasa a revisión", async () => {
    await inRollback(async (c) => {
      const { staff, cliente, e } = await aceptada(c);
      await actAs(c, staff);
      await c.query(
        "insert into public.payments (engagement_id, amount_cents, method, paid_on) values ($1, 121000, 'transferencia', current_date)",
        [e],
      );
      const rev2 = (
        await c.query(
          "insert into public.engagement_revisions (engagement_id, reason) values ($1, 'Rebaja') returning id",
          [e],
        )
      ).rows[0].id;
      await c.query(
        "update public.engagement_lines set unit_price_cents = 50000 where revision_id = $1",
        [rev2],
      );
      await c.query("update public.engagement_revisions set status = 'propuesta' where id = $1", [
        rev2,
      ]);
      await actAs(c, cliente);
      await c.query("select public.accept_engagement_revision($1)", [rev2]);
      const { rows } = await c.query(
        "select status, public.amount_due_now($1)::int as exigible from public.engagement_collections where engagement_id = $1",
        [e],
      );
      expect(rows[0]).toEqual({ status: "pendiente_revision", exigible: 0 });
    });
  });
});
