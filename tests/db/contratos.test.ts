import { afterAll, describe, expect, it } from "vitest";
import { actAs, createAuthUser, db, inRollback } from "./_db";
import {
  actAsConCodigo,
  anadirLinea,
  comoPostgres,
  contratoEnviado,
  crearOrganizacion,
  datosFiscales,
  FIRMA_PNG,
  fallo,
  hacerMiembro,
  hacerStaff,
  revisionDe,
} from "./_excelsior";

/**
 * Módulo CONTRATOS: plantillas y cláusulas versionadas, composición del texto
 * en la base, visibilidad, firma con código verificado y delegación (D-12).
 */
afterAll(async () => {
  await db?.end();
});

const firmar = (contrato: string, firma = FIRMA_PNG) =>
  [contrato, "Ana García López", "12345678-z", "Administradora", firma, true] as unknown[];
const SQL_FIRMA = "select public.sign_contract($1, $2, $3, $4, $5, $6) as hash";

describe.skipIf(!db)("plantillas y cláusulas", () => {
  it("solo un admin las crea; un hueco desconocido no se guarda; las versiones son inmutables", async () => {
    await inRollback(async (c) => {
      const admin = await createAuthUser(c, { email: "admin@r3zon.test" });
      const staff = await createAuthUser(c, { email: "staff@r3zon.test" });
      await hacerStaff(c, admin, "admin");
      await hacerStaff(c, staff, "staff");

      await actAs(c, staff);
      expect(await fallo(c, "insert into public.contract_templates (name) values ('X')")).toMatch(
        /row-level security/,
      );

      await comoPostgres(c);
      await actAs(c, admin);
      const t = (
        await c.query("insert into public.contract_templates (name) values ('Marco') returning id")
      ).rows[0].id;
      expect(
        await fallo(
          c,
          "insert into public.contract_template_versions (template_id, body) values ($1, 'Hola {{cliente.inventado}} y {{precio.base}}')",
          [t],
        ),
      ).toMatch(/Huecos desconocidos: cliente.inventado/);
      const v = await c.query(
        "insert into public.contract_template_versions (template_id, body) values ($1, 'Hola {{ cliente.razon_social }}') returning id, version",
        [t],
      );
      expect(v.rows[0].version).toBe(1);
      // Dos capas: sin permiso de UPDATE para nadie de la app, y el trigger
      // también para postgres.
      const editar = "update public.contract_template_versions set body = 'x' where id = $1";
      expect(await fallo(c, editar, [v.rows[0].id])).toMatch(/permission denied/);
      await comoPostgres(c);
      expect(await fallo(c, editar, [v.rows[0].id])).toMatch(/no se modifica/);
    });
  });
});

describe.skipIf(!db)("composición del texto", () => {
  it("rellena huecos, añade cláusulas activadas y anexos, y marca lo pendiente", async () => {
    await inRollback(async (c) => {
      const { contrato } = await contratoEnviado(c);
      const { rows } = await c.query("select public.contract_render($1) as texto", [contrato]);
      const texto: string = rows[0].texto;
      expect(texto).toContain("Entre R3ZON S.L. y Acme Soluciones S.L. (B12345678)");
      expect(texto).toContain("Precio: 1.500,00 € + IVA (21,00 %) = 1.815,00 €.");
      expect(texto).toContain(
        "## Protección de datos\n\nR3ZON actuará como encargado del tratamiento.",
      );
      expect(texto).toContain("## Anexo 1. Calendario\n\nEntrega en 30 días.");
      expect(texto).toContain("[pendiente: firmante.nombre]");
      expect(texto).not.toMatch(/\{\{/);
    });
  });

  it("el cliente no ve un contrato en borrador, ni puede componer el de otra empresa", async () => {
    await inRollback(async (c) => {
      const { owner, contrato } = await contratoEnviado(c);
      const ajeno = await createAuthUser(c, { email: "bea@otra.test" });
      const otra = await crearOrganizacion(c, "Otra");
      await hacerMiembro(c, otra, ajeno, "owner");

      await actAs(c, ajeno);
      const r = await c.query("select public.contract_render($1) as texto", [contrato]);
      expect(r.rows[0].texto).toBeNull();

      await comoPostgres(c);
      await c.query("update public.contracts set status = 'borrador' where id = $1", [contrato]);
      await actAs(c, owner);
      const visible = await c.query("select 1 from public.contracts where id = $1", [contrato]);
      expect(visible.rowCount).toBe(0);
    });
  });

  it("cláusulas y anexos solo cambian en borrador", async () => {
    await inRollback(async (c) => {
      const { contrato } = await contratoEnviado(c);
      expect(
        await fallo(c, "delete from public.contract_annexes where contract_id = $1", [contrato]),
      ).toMatch(/ya no está en borrador/);
      await c.query("update public.contracts set status = 'borrador' where id = $1", [contrato]);
      await c.query("delete from public.contract_annexes where contract_id = $1", [contrato]);
    });
  });
});

describe.skipIf(!db)("firma", () => {
  it("el propietario firma con código verificado: texto, huella, evidencias y contratación firmada", async () => {
    await inRollback(async (c) => {
      const { owner, contrato, engagement } = await contratoEnviado(c);
      await actAsConCodigo(c, owner, 60);
      const { rows } = await c.query(SQL_FIRMA, firmar(contrato));
      expect(rows[0]!.hash).toMatch(/^[0-9a-f]{64}$/);

      await comoPostgres(c);
      const k = await c.query(
        `select status, encode(text_sha256, 'hex') = encode(extensions.digest(signed_text, 'sha256'), 'hex') as huella_ok,
                signed_text like '%Ana García López (12345678Z)%' as firmante_ok
           from public.contracts where id = $1`,
        [contrato],
      );
      expect(k.rows[0]).toEqual({ status: "firmado", huella_ok: true, firmante_ok: true });
      const s = await c.query(
        "select signer_email, signer_tax_id, encode(text_sha256, 'hex') as hash from public.contract_signatures where contract_id = $1",
        [contrato],
      );
      expect(s.rows[0]).toEqual({
        signer_email: "ana@acme.test",
        signer_tax_id: "12345678Z",
        hash: rows[0]!.hash,
      });
      const e = await c.query("select status from public.engagements where id = $1", [engagement]);
      expect(e.rows[0].status).toBe("firmada");
    });
  });

  it("sin código verificado, o con uno de hace más de 10 minutos, no se firma", async () => {
    await inRollback(async (c) => {
      const { owner, contrato } = await contratoEnviado(c);
      await actAs(c, owner);
      expect(await fallo(c, SQL_FIRMA, firmar(contrato))).toMatch(/código/);
      await comoPostgres(c);
      await actAsConCodigo(c, owner, 11 * 60);
      expect(await fallo(c, SQL_FIRMA, firmar(contrato))).toMatch(/código/);
    });
  });

  it("solo firma un propietario, con aceptación expresa y firma dibujada", async () => {
    await inRollback(async (c) => {
      const { org, owner, contrato } = await contratoEnviado(c);
      const luis = await createAuthUser(c, { email: "luis@acme.test" });
      await hacerMiembro(c, org, luis, "billing");

      await actAsConCodigo(c, luis);
      expect(await fallo(c, SQL_FIRMA, firmar(contrato))).toMatch(/propietario/);

      await comoPostgres(c);
      await actAsConCodigo(c, owner);
      const sinAceptar = [...firmar(contrato)];
      sinAceptar[5] = false;
      expect(await fallo(c, SQL_FIRMA, sinAceptar)).toMatch(/aceptar/);
      expect(await fallo(c, SQL_FIRMA, firmar(contrato, "data:image/png;base64,AAAA"))).toMatch(
        /firma/,
      );
    });
  });

  it("lo firmado es inmutable y nadie lo firma por otra vía", async () => {
    await inRollback(async (c) => {
      const { owner, contrato } = await contratoEnviado(c);
      const staff = await createAuthUser(c, { email: "staff@r3zon.test" });
      await hacerStaff(c, staff);

      await actAs(c, staff);
      expect(
        await fallo(c, "update public.contracts set status = 'firmado' where id = $1", [contrato]),
      ).toMatch(/sign_contract|signed_consistency|permission/);

      await comoPostgres(c);
      await actAsConCodigo(c, owner);
      await c.query(SQL_FIRMA, firmar(contrato));
      await comoPostgres(c);
      expect(
        await fallo(c, "update public.contracts set signed_text = 'otro' where id = $1", [
          contrato,
        ]),
      ).toMatch(/firmado no se modifica/);
      expect(
        await fallo(c, "delete from public.contract_signatures where contract_id = $1", [contrato]),
      ).toMatch(/no se modifica/);
      // Cambiar los datos fiscales después no cambia lo firmado.
      await c.query("update public.organization_billing set legal_name = 'Otro nombre S.A.'");
      const t = await c.query(
        "select signed_text like '%Acme Soluciones S.L.%' as igual from public.contracts where id = $1",
        [contrato],
      );
      expect(t.rows[0].igual).toBe(true);
    });
  });

  it("facturación puede delegar la firma; un miembro sin rol no", async () => {
    await inRollback(async (c) => {
      const { org, contrato } = await contratoEnviado(c);
      const fact = await createAuthUser(c, { email: "fact@acme.test" });
      const miembro = await createAuthUser(c, { email: "miembro@acme.test" });
      await hacerMiembro(c, org, fact, "billing");
      await hacerMiembro(c, org, miembro, "member");

      await actAs(c, miembro);
      expect(
        await fallo(c, "select public.delegate_contract_signature($1, 'gerente@acme.test')", [
          contrato,
        ]),
      ).toMatch(/Solo el propietario o facturación/);

      await comoPostgres(c);
      await actAs(c, fact);
      const { rows } = await c.query(
        "select public.delegate_contract_signature($1, ' Gerente@Acme.test ') as token",
        [contrato],
      );
      expect(rows[0].token).toMatch(/^[0-9a-f]{64}$/);
      await comoPostgres(c);
      const inv = await c.query(
        "select role, created_by from public.invitations where organization_id = $1 and email = 'gerente@acme.test'",
        [org],
      );
      expect(inv.rows).toEqual([{ role: "owner", created_by: fact }]);
    });
  });
});

describe.skipIf(!db)("composición del texto: condiciones económicas", () => {
  it("detalla los servicios, descuentos, IVA por tipo e hitos de la revisión", async () => {
    await inRollback(async (c) => {
      const { version } = await contratoEnviado(c);
      const org = await crearOrganizacion(c, "Varios S.L.");
      await datosFiscales(c, org);
      const e = (
        await c.query("insert into public.engagements (organization_id) values ($1) returning id", [
          org,
        ])
      ).rows[0].id;
      const rev = await revisionDe(c, e);
      await anadirLinea(c, rev, { nombre: "Web", precio: 100000, descuentoPorcentaje: "10" });
      await anadirLinea(c, rev, { nombre: "Formación", precio: 20000, iva: "10" });
      await c.query(
        "insert into public.engagement_milestones (revision_id, label, weight) values ($1, 'Al empezar', 1), ($1, 'A la entrega', 1)",
        [rev],
      );
      await c.query(
        "update public.engagement_revisions set conditions = 'Transferencia a 15 días.' where id = $1",
        [rev],
      );
      await c.query("update public.engagements set status = 'invitada' where id = $1", [e]);
      await c.query("update public.engagements set status = 'datos_completos' where id = $1", [e]);
      const plantilla = (
        await c.query(
          `insert into public.contract_template_versions (template_id, body)
           select template_id, '{{servicios.detalle}}' || E'\n\n' || 'Base {{precio.base}}, descuento {{precio.descuento}}, IVA {{precio.iva}} ({{precio.iva_porcentaje}}), total {{precio.total}}.'
                  || E'\n\n' || '{{pago.hitos}}' || E'\n\n' || '{{contrato.condiciones}} Revisión {{contrato.revision}}.'
             from public.contract_template_versions where id = $1 returning id`,
          [version],
        )
      ).rows[0].id;
      const contrato = (
        await c.query(
          "insert into public.contracts (engagement_id, template_version_id) values ($1, $2) returning id",
          [e, plantilla],
        )
      ).rows[0].id;
      const { rows } = await c.query("select public.contract_render($1) as t", [contrato]);
      const t: string = rows[0].t;
      expect(t).toContain(
        "- **Web** (Desarrollo web)\n  Precio: 1.000,00 € · descuento: 100,00 € (10,00 %) · base: 900,00 € · IVA 21,00 %",
      );
      expect(t).toContain(
        "- **Formación** (Desarrollo web)\n  Precio: 200,00 € · base: 200,00 € · IVA 10,00 %",
      );
      // 21 % de 900 = 189; 10 % de 200 = 20.
      expect(t).toContain(
        "Base 1.100,00 €, descuento 100,00 €, IVA 209,00 € (21,00 % y 10,00 %), total 1.309,00 €.",
      );
      expect(t).toContain("- Al empezar: 654,50 €\n- A la entrega: 654,50 €");
      expect(t).toContain("Transferencia a 15 días. Revisión 1.");
    });
  });
});

describe.skipIf(!db)("cambio de condiciones con el contrato ya firmado", () => {
  it("se firma un contrato nuevo con la revisión propuesta, que sustituye al anterior", async () => {
    await inRollback(async (c) => {
      const { owner, contrato, engagement, version } = await contratoEnviado(c);
      const staff = await createAuthUser(c, { email: "staff@r3zon.test" });
      await hacerStaff(c, staff);
      await actAsConCodigo(c, owner);
      await c.query(SQL_FIRMA, firmar(contrato));

      // Sin un cambio en curso, no hay contrato nuevo.
      await comoPostgres(c);
      await actAs(c, staff);
      expect(
        await fallo(
          c,
          "insert into public.contracts (engagement_id, template_version_id) values ($1, $2)",
          [engagement, version],
        ),
      ).toMatch(/crea antes una revisión/);

      const rev2 = (
        await c.query(
          "insert into public.engagement_revisions (engagement_id, reason) values ($1, 'Más páginas') returning id",
          [engagement],
        )
      ).rows[0].id;
      await c.query(
        "update public.engagement_lines set unit_price_cents = 200000 where revision_id = $1",
        [rev2],
      );
      await c.query("update public.engagement_revisions set status = 'propuesta' where id = $1", [
        rev2,
      ]);
      const nuevo = (
        await c.query(
          "insert into public.contracts (engagement_id, template_version_id) values ($1, $2) returning id",
          [engagement, version],
        )
      ).rows[0].id;
      await c.query("update public.contracts set status = 'enviado' where id = $1", [nuevo]);

      // Con contrato firmado, el cambio no se acepta con un clic: se firma.
      await comoPostgres(c);
      await actAs(c, owner);
      expect(await fallo(c, "select public.accept_engagement_revision($1)", [rev2])).toMatch(
        /firmando el contrato nuevo/,
      );
      const vista = await c.query("select public.contract_render($1) as t", [nuevo]);
      expect(vista.rows[0].t).toContain("Precio: 2.000,00 € + IVA (21,00 %) = 2.420,00 €.");

      await comoPostgres(c);
      await actAsConCodigo(c, owner);
      await c.query(SQL_FIRMA, firmar(nuevo));
      await comoPostgres(c);
      const k = await c.query(
        `select c.status, c.signed_text like '%2.420,00 €%' as nuevo_precio, r.number, r.status as revision
           from public.contracts c join public.engagement_revisions r on r.id = c.revision_id
          where c.engagement_id = $1 order by c.created_at, c.id`,
        [engagement],
      );
      expect(k.rows).toEqual([
        { status: "sustituido", nuevo_precio: false, number: 1, revision: "sustituida" },
        { status: "firmado", nuevo_precio: true, number: 2, revision: "aceptada" },
      ]);
      const e = await c.query(
        "select e.status, e.current_revision_id = $2 as vigente from public.engagements e where e.id = $1",
        [engagement, rev2],
      );
      expect(e.rows[0]).toEqual({ status: "firmada", vigente: true });
    });
  });

  it("nadie marca un contrato como sustituido a mano", async () => {
    await inRollback(async (c) => {
      const { owner, contrato } = await contratoEnviado(c);
      await actAsConCodigo(c, owner);
      await c.query(SQL_FIRMA, firmar(contrato));
      await comoPostgres(c);
      expect(
        await fallo(c, "update public.contracts set status = 'sustituido' where id = $1", [
          contrato,
        ]),
      ).toMatch(/sign_contract/);
    });
  });
});
