import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { urlBaseLocal } from "../../scripts/lib/supabase-local.mjs";
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
 * Módulo COBROS contra PostgreSQL real. Los escenarios del informe de R3ZON
 * (2026-10-23): clientes sin pagar, pagados, parciales, con varias
 * transferencias, sin efectivo, con Stripe y externos combinados, con una
 * operación pendiente, ya facturados en Antares, invitación duplicada e
 * intento de cobrar lo ya pagado. Además: autorización, concurrencia e
 * idempotencia.
 *
 * Precio de los escenarios: 1.000 € + 21 % IVA = 1.210 € (121000 céntimos).
 */
afterAll(async () => {
  await db?.end();
});

type C = Parameters<Parameters<typeof inRollback>[0]>[0];

async function escenario(c: C) {
  const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
  await hacerStaff(c, staff);
  const org = await crearOrganizacion(c, "Acme");
  const { versionId } = await crearServicio(c, `Web ${Math.random()}`, { precio: 100000 });
  const e = await crearContratacion(c, org, versionId);
  await c.query("update public.engagements set price_cents = 100000 where id = $1", [e]);
  return { staff, org, e };
}

const EXTERNO =
  "insert into public.payments (engagement_id, amount_cents, method, paid_on, reference) values ($1, $2, $3, current_date, $4)";
const STRIPE =
  "insert into public.payments (engagement_id, amount_cents, method, status, paid_on, provider_reference) values ($1, $2, 'stripe', $3, current_date, $4)";

const cobroExterno = (
  c: C,
  e: string,
  importe: number,
  metodo = "transferencia",
  referencia = "TRF",
) => c.query(EXTERNO, [e, importe, metodo, referencia]);

async function estado(c: C, e: string) {
  const { rows } = await c.query(
    `select status, total_cents::int as total, paid_cents::int as pagado, balance_cents::int as pendiente,
            public.amount_due_now($1)::int as exigible
       from public.engagement_collections where engagement_id = $1`,
    [e],
  );
  return rows[0];
}

describe.skipIf(!db)("cobros: escenarios", () => {
  it("1. cliente nuevo sin pagos: no pagado y se le puede pedir el total", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c);
      expect(await estado(c, e)).toEqual({
        status: "no_pagado",
        total: 121000,
        pagado: 0,
        pendiente: 121000,
        exigible: 121000,
      });
    });
  });

  it("2. cliente que ya pagó todo fuera: pagado y no se le pide nada", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 121000);
      expect(await estado(c, e)).toMatchObject({ status: "pagado", pendiente: 0, exigible: 0 });
    });
  });

  it("3 y 4. parcialmente pagado con varias transferencias: solo se pide el resto", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 30000, "transferencia", "TRF-1");
      await cobroExterno(c, e, 20000, "transferencia", "TRF-2");
      expect(await estado(c, e)).toMatchObject({
        status: "parcialmente_pagado",
        pagado: 50000,
        pendiente: 71000,
        exigible: 71000,
      });
    });
  });

  it("5. no existe el efectivo como método", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      expect(await fallo(c, EXTERNO, [e, 100, "efectivo", "Caja"])).toMatch(
        /invalid input value for enum/,
      );
    });
  });

  it("6. Stripe y cobros externos combinados suman; el equipo no puede inventar un cobro de Stripe", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      // El servidor (webhook) registra una operación de Stripe confirmada.
      await c.query(STRIPE, [e, 61000, "confirmado", "pi_1"]);
      await actAs(c, staff);
      await cobroExterno(c, e, 60000);
      expect(await estado(c, e)).toMatchObject({ status: "pagado", pagado: 121000 });
      expect(
        await fallo(
          c,
          "insert into public.payments (engagement_id, amount_cents, method, paid_on) values ($1, 1, 'stripe', current_date)",
          [e],
        ),
      ).toMatch(/permission denied|solo los registra el servidor/);
    });
  });

  it("7. una operación pendiente de conciliar bloquea pedir más y deja el cobro en revisión", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await c.query(STRIPE, [e, 121000, "pendiente", "pi_2"]);
      expect(await estado(c, e)).toMatchObject({ status: "pendiente_revision", exigible: 0 });
      await actAs(c, staff);
      // Registrar fuera lo mismo duplicaría el cobro: la base lo impide.
      expect(await fallo(c, EXTERNO, [e, 121000, "transferencia", "TRF"])).toMatch(
        /superaría el total/,
      );
      await comoPostgres(c);
      await c.query(
        "update public.payments set status = 'confirmado' where provider_reference = 'pi_2'",
      );
      expect(await estado(c, e)).toMatchObject({ status: "pagado" });
    });
  });

  it("7 bis. R3ZON marca la revisión: no se pide nada hasta cerrarla", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await c.query(
        "update public.engagements set payment_review = true, payment_review_note = 'Dos transferencias iguales' where id = $1",
        [e],
      );
      expect(await estado(c, e)).toMatchObject({ status: "pendiente_revision", exigible: 0 });
      await c.query("update public.engagements set payment_review = false where id = $1", [e]);
      expect(await estado(c, e)).toMatchObject({ status: "no_pagado", exigible: 121000 });
    });
  });

  it("8. un cobro ya facturado en Antares no se vuelve a facturar ni se anula aquí", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 121000);
      const id = (await c.query("select id from public.payments where engagement_id = $1", [e]))
        .rows[0].id;
      await c.query(
        "update public.payments set invoice_reference = ' TBAI-2026-0001 ' where id = $1",
        [id],
      );
      const r = await c.query(
        "select invoice_reference, invoiced_at is not null as fecha from public.payments where id = $1",
        [id],
      );
      expect(r.rows[0]).toEqual({ invoice_reference: "TBAI-2026-0001", fecha: true });
      expect(
        await fallo(c, "update public.payments set invoice_reference = 'OTRA' where id = $1", [id]),
      ).toMatch(/no se cambia/);
      expect(
        await fallo(
          c,
          "update public.payments set status = 'anulado', voided_reason = 'error' where id = $1",
          [id],
        ),
      ).toMatch(/ya está facturado/);
    });
  });

  it("9. una invitación duplicada no deja dos enlaces vivos para la misma alta", async () => {
    await inRollback(async (c) => {
      const { staff, org, e } = await escenario(c);
      await actAs(c, staff);
      await c.query("select public.invite_engagement($1, 'ana@acme.test')", [e]);
      await c.query("select public.invite_engagement($1, 'otra.persona@acme.test')", [e]);
      await c.query("select public.invite_engagement($1, 'ana@acme.test')", [e]);
      const abiertas = await c.query(
        "select email from public.invitations where organization_id = $1 and accepted_at is null and revoked_at is null",
        [org],
      );
      expect(abiertas.rows).toEqual([{ email: "ana@acme.test" }]);
      const enlazada = await c.query(
        "select i.email, e.status from public.engagements e join public.invitations i on i.id = e.invitation_id where e.id = $1",
        [e],
      );
      expect(enlazada.rows).toEqual([{ email: "ana@acme.test", status: "invitada" }]);
    });
  });

  it("10. no se puede cobrar lo ya satisfecho, ni pasarse del total", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 121000);
      expect(await fallo(c, EXTERNO, [e, 1, "transferencia", "TRF"])).toMatch(/superaría el total/);
      await comoPostgres(c);
      expect(await fallo(c, STRIPE, [e, 100, "pendiente", "pi_3"])).toMatch(/superaría el total/);
    });
  });
});

describe.skipIf(!db)("cobros: integridad y autorización", () => {
  it("un cobro no se edita ni se borra; se anula con motivo y el saldo vuelve", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 50000);
      const id = (await c.query("select id from public.payments where engagement_id = $1", [e]))
        .rows[0].id;
      expect(
        await fallo(c, "update public.payments set amount_cents = 1 where id = $1", [id]),
      ).toMatch(/permission denied/);
      expect(await fallo(c, "delete from public.payments where id = $1", [id])).toMatch(
        /permission denied/,
      );
      expect(
        await fallo(c, "update public.payments set status = 'anulado' where id = $1", [id]),
      ).toMatch(/motivo/);
      await c.query(
        "update public.payments set status = 'anulado', voided_reason = 'Importe mal tecleado' where id = $1",
        [id],
      );
      expect(await estado(c, e)).toMatchObject({ status: "no_pagado", pagado: 0 });
      await comoPostgres(c);
      expect(await fallo(c, "delete from public.payments where id = $1", [id])).toMatch(
        /no se borra/,
      );
      expect(
        await fallo(c, "update public.payments set amount_cents = 1 where id = $1", [id]),
      ).toMatch(/no se modifica/);
    });
  });

  it("el cliente ve sus cobros y su estado, no los toca, y otra empresa no los ve", async () => {
    await inRollback(async (c) => {
      const { staff, org, e } = await escenario(c);
      const ana = await createAuthUser(c, { email: "ana@acme.test" });
      const bea = await createAuthUser(c, { email: "bea@otra.test" });
      await hacerMiembro(c, org, ana, "owner");
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, otra, bea, "owner");
      await actAs(c, staff);
      await cobroExterno(c, e, 50000);

      await comoPostgres(c);
      await actAs(c, ana);
      expect(
        (await c.query("select 1 from public.payments where engagement_id = $1", [e])).rowCount,
      ).toBe(1);
      expect(await estado(c, e)).toMatchObject({ status: "parcialmente_pagado", exigible: 71000 });
      // No puede registrar un cobro: ni bloquear la contratación (trigger) ni pasar la RLS.
      expect(await fallo(c, EXTERNO, [e, 71000, "transferencia", "TRF"])).toMatch(
        /row-level security|permission|no existe/,
      );
      const r = await c.query(
        "update public.payments set invoice_reference = 'X' where engagement_id = $1",
        [e],
      );
      expect(r.rowCount).toBe(0);
      const rev = await c.query(
        "update public.engagements set payment_review = true where id = $1",
        [e],
      );
      expect(rev.rowCount).toBe(0);

      await comoPostgres(c);
      await actAs(c, bea);
      expect(
        (await c.query("select 1 from public.payments where engagement_id = $1", [e])).rowCount,
      ).toBe(0);
      expect(
        (await c.query("select 1 from public.engagement_collections where engagement_id = $1", [e]))
          .rowCount,
      ).toBe(0);
    });
  });

  it("idempotencia: el mismo evento de Stripe no se registra dos veces", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c);
      await c.query(STRIPE, [e, 1000, "confirmado", "pi_idem"]);
      expect(await fallo(c, STRIPE, [e, 1000, "confirmado", "pi_idem"])).toMatch(
        /duplicate key|unique/,
      );
    });
  });

  it("no paga en el portal: no se le pide nada aunque deba", async () => {
    await inRollback(async (c) => {
      const { e } = await escenario(c);
      await c.query("update public.engagements set requires_payment = false where id = $1", [e]);
      expect(await estado(c, e)).toMatchObject({ status: "no_pagado", exigible: 0 });
    });
  });

  it("cobros y revisión quedan en el registro, sin las referencias que escribe el equipo", async () => {
    await inRollback(async (c) => {
      const { staff, org, e } = await escenario(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 1000, "otro", "Bizum a la cuenta de empresa");
      await c.query("update public.engagements set payment_review = true where id = $1", [e]);
      await comoPostgres(c);
      const { rows } = await c.query(
        "select action, details::text as d from public.audit_log where organization_id = $1 and action like any (array['payment.%', 'collection.%']) order by created_at, id",
        [org],
      );
      expect(rows.map((r) => r.action)).toEqual(["payment.registered", "collection.review_opened"]);
      expect(rows[0].d).not.toContain("Bizum");
    });
  });
});

describe.skipIf(!db)("cobros: concurrencia", () => {
  it("dos registros simultáneos no pueden pasar los dos el control del total", async () => {
    // Datos confirmados (fuera de rollback) para que los vean dos conexiones.
    // Quedan en la base local: es una base de pruebas, y los tests no suponen
    // que esté vacía.
    const sufijo = Math.random().toString(36).slice(2, 8);
    const org = (
      await db!.query("insert into public.organizations (name) values ($1) returning id", [
        `Concurrencia ${sufijo}`,
      ])
    ).rows[0].id;
    const s = (
      await db!.query("insert into public.services (name) values ($1) returning id", [
        `Servicio concurrencia ${sufijo}`,
      ])
    ).rows[0].id;
    const v = (
      await db!.query(
        "insert into public.service_versions (service_id, price_cents) values ($1, 100000) returning id",
        [s],
      )
    ).rows[0].id;
    const e = (
      await db!.query(
        "insert into public.engagements (organization_id, service_version_id, price_cents) values ($1, $2, 100000) returning id",
        [org, v],
      )
    ).rows[0].id;

    const otra = new Client({ connectionString: urlBaseLocal() });
    await otra.connect();
    const insertar =
      "insert into public.payments (engagement_id, amount_cents, method, paid_on) values ($1, 121000, 'transferencia', current_date)";
    try {
      await db!.query("begin");
      await db!.query(insertar, [e]); // primera conexión: cubre el total, sin confirmar aún
      await otra.query("begin");
      await otra.query("set local lock_timeout = '1s'");
      // La segunda espera al bloqueo de la contratación en vez de pasar el control a la vez.
      await expect(otra.query(insertar, [e])).rejects.toThrow(/lock timeout/);
      await otra.query("rollback");
      await db!.query("commit");

      // Ya confirmada la primera, la segunda falla por superar el total.
      await otra.query("begin");
      await expect(otra.query(insertar, [e])).rejects.toThrow(/superaría el total/);
      await otra.query("rollback");
    } finally {
      await db!.query("rollback").catch(() => undefined);
      await otra.end();
    }
  });
});

describe.skipIf(!db)("cobros: señal + entrega (T-31)", () => {
  async function conSenal(c: C) {
    const staff = await createAuthUser(c, { email: `staff-${Math.random()}@r3zon.test` });
    await hacerStaff(c, staff);
    const org = await crearOrganizacion(c, "Acme");
    const { versionId } = await crearServicio(c, `Web ${Math.random()}`, {
      precio: 100000,
      planes: ["senal_entrega", "pago_unico"],
      senal: 30,
    });
    const e = await crearContratacion(c, org, versionId);
    await c.query(
      "update public.engagements set price_cents = 100000, status = 'invitada' where id = $1",
      [e],
    );
    await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
    return { staff, org, e };
  }

  const exigible = async (c: C, e: string) =>
    (await c.query("select public.amount_due_now($1)::int as x", [e])).rows[0].x;

  it("pide solo la señal hasta la entrega y el resto después", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await conSenal(c);
      const fila = await c.query(
        "select payment_plan, deposit_cents::int as senal from public.engagement_collections where engagement_id = $1",
        [e],
      );
      // La primera modalidad del servicio, y la señal sobre el total con IVA: 30 % de 1.210 €.
      expect(fila.rows[0]).toEqual({ payment_plan: "senal_entrega", senal: 36300 });
      expect(await exigible(c, e)).toBe(36300);

      await actAs(c, staff);
      await cobroExterno(c, e, 36300);
      expect(await estado(c, e)).toMatchObject({ status: "parcialmente_pagado", exigible: 0 });

      await c.query("update public.engagements set delivered_at = now() where id = $1", [e]);
      expect(await exigible(c, e)).toBe(84700);
    });
  });

  it("una señal pagada de más no se vuelve a pedir: solo el saldo tras la entrega", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await conSenal(c);
      await actAs(c, staff);
      await cobroExterno(c, e, 50000);
      expect(await exigible(c, e)).toBe(0);
      await c.query("update public.engagements set delivered_at = now() where id = $1", [e]);
      expect(await exigible(c, e)).toBe(71000);
    });
  });

  it("la entrega se marca una vez, con la hora de la base, y no se desmarca", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await conSenal(c);
      await actAs(c, staff);
      await c.query("update public.engagements set delivered_at = '2000-01-01' where id = $1", [e]);
      const { rows } = await c.query(
        "select delivered_at > now() - interval '1 minute' as ahora from public.engagements where id = $1",
        [e],
      );
      expect(rows[0].ahora).toBe(true);
      expect(
        await fallo(c, "update public.engagements set delivered_at = null where id = $1", [e]),
      ).toMatch(/ya está marcada/);
      expect(
        await fallo(
          c,
          "update public.engagements set delivered_at = now() + interval '1 day' where id = $1",
          [e],
        ),
      ).toMatch(/ya está marcada/);
    });
  });

  it("no hay entrega con pago único, ni antes de que el cliente dé sus datos", async () => {
    await inRollback(async (c) => {
      const { staff, e } = await escenario(c);
      await actAs(c, staff);
      expect(
        await fallo(c, "update public.engagements set delivered_at = now() where id = $1", [e]),
      ).toMatch(/señal \+ entrega/);

      await comoPostgres(c);
      const org = await crearOrganizacion(c, "Temprana");
      const { versionId } = await crearServicio(c, `Señal ${Math.random()}`, {
        planes: ["senal_entrega"],
        senal: 40,
      });
      const temprana = await crearContratacion(c, org, versionId);
      await actAs(c, staff);
      expect(
        await fallo(c, "update public.engagements set delivered_at = now() where id = $1", [
          temprana,
        ]),
      ).toMatch(/No se puede marcar la entrega en estado borrador/);
    });
  });

  it("el cliente no marca la entrega: solo el equipo, y queda en el registro", async () => {
    await inRollback(async (c) => {
      const { staff, org, e } = await conSenal(c);
      const cliente = await createAuthUser(c, { email: `cli-${Math.random()}@acme.test` });
      await hacerMiembro(c, org, cliente, "owner");

      await actAs(c, cliente);
      const r = await c.query(
        "update public.engagements set delivered_at = now() where id = $1 returning id",
        [e],
      );
      expect(r.rowCount).toBe(0); // la RLS no le deja escribir la contratación

      await actAs(c, staff);
      await c.query("update public.engagements set delivered_at = now() where id = $1", [e]);
      await comoPostgres(c);
      const log = await c.query(
        "select 1 from public.audit_log where action = 'engagement.delivered' and organization_id = $1",
        [org],
      );
      expect(log.rowCount).toBe(1);
    });
  });
});
