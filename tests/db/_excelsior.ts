import type { Client } from "pg";

/**
 * Ayudas para los tests de BD del dominio de Excelsior. Se ejecutan como
 * `postgres` (sin RLS) para preparar datos; cada test cambia luego de rol con
 * `actAs()` para comprobar lo que ve y hace un usuario.
 */

/** Vuelve a `postgres` y borra los claims del JWT. */
export async function comoPostgres(c: Client): Promise<void> {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
}

export async function crearOrganizacion(c: Client, nombre: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    "insert into public.organizations (name) values ($1) returning id",
    [nombre],
  );
  return rows[0]!.id;
}

export async function hacerStaff(c: Client, userId: string, nivel: "staff" | "admin" = "staff") {
  await c.query("update public.profiles set platform_role = $2 where id = $1", [userId, nivel]);
}

export async function hacerMiembro(
  c: Client,
  organizationId: string,
  userId: string,
  rol: "owner" | "member" | "billing" = "member",
) {
  await c.query(
    "insert into public.organization_members (organization_id, user_id, role) values ($1, $2, $3)",
    [organizationId, userId, rol],
  );
}

/** Crea una invitación con la función real y devuelve el token en claro. */
export async function invitar(
  c: Client,
  organizationId: string,
  email: string,
  rol: "owner" | "member" | "billing" = "owner",
): Promise<string> {
  const { rows } = await c.query<{ token: string }>(
    "select public.create_invitation($1, $2, $3) as token",
    [organizationId, email, rol],
  );
  return rows[0]!.token;
}

/** Inserta una invitación ya caducada (creada hace 10 días, válida 7). */
export async function invitacionCaducada(c: Client, organizationId: string, email: string) {
  const token = "ab".repeat(32);
  await c.query(
    `insert into public.invitations (organization_id, email, role, token_hash, created_at, expires_at)
     values ($1, $2, 'owner', extensions.digest($3, 'sha256'), now() - interval '10 days', now() - interval '3 days')`,
    [organizationId, email, token],
  );
  return token;
}

/**
 * Ejecuta `sql` esperando que falle, sin abortar la transacción del test
 * (savepoint). Devuelve el mensaje de error, o lanza si NO falló.
 */
export async function fallo(c: Client, sql: string, params: unknown[] = []): Promise<string> {
  await c.query("savepoint fallo_esperado");
  try {
    await c.query(sql, params);
  } catch (err) {
    await c.query("rollback to savepoint fallo_esperado");
    return (err as Error).message;
  }
  await c.query("release savepoint fallo_esperado");
  throw new Error(`Se esperaba un error y no lo hubo: ${sql}`);
}

/** Evento del hook `before_user_created` como lo envía Supabase Auth. */
export function eventoAlta(email: string, provider: "email" | "google", metadata: object = {}) {
  return JSON.stringify({
    metadata: { name: "before-user-created" },
    user: { email, app_metadata: { provider, providers: [provider] }, user_metadata: metadata },
  });
}

/** Id de una categoría de servicio por su nombre (las crea la migración). */
export async function categoria(c: Client, nombre = "Desarrollo web"): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    "select id from public.service_categories where name = $1",
    [nombre],
  );
  return rows[0]!.id;
}

/** Crea un servicio con su primera versión (como postgres). Devuelve los ids. */
export async function crearServicio(
  c: Client,
  nombre: string,
  opciones: { precio?: number; iva?: string } = {},
): Promise<{ serviceId: string; versionId: string }> {
  const s = await c.query<{ id: string }>(
    "insert into public.services (name, category_id) values ($1, $2) returning id",
    [nombre, await categoria(c)],
  );
  const serviceId = s.rows[0]!.id;
  const v = await c.query<{ id: string }>(
    `insert into public.service_versions (service_id, price_cents, vat_rate)
     values ($1, $2, $3) returning id`,
    [serviceId, opciones.precio ?? 150000, opciones.iva ?? "21"],
  );
  return { serviceId, versionId: v.rows[0]!.id };
}

/** Revisión de condiciones vigente de una contratación. */
export async function revisionDe(c: Client, engagementId: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    "select current_revision_id as id from public.engagements where id = $1",
    [engagementId],
  );
  return rows[0]!.id;
}

/**
 * Crea una contratación en borrador (como postgres) con UNA línea copiada del
 * servicio (`precio` en céntimos, sin IVA; 150000 si no se dice).
 */
export async function crearContratacion(
  c: Client,
  organizationId: string,
  versionId: string,
  precio = 150000,
) {
  const { rows } = await c.query<{ id: string }>(
    "insert into public.engagements (organization_id) values ($1) returning id",
    [organizationId],
  );
  const id = rows[0]!.id;
  await c.query("select public.add_catalog_line($1, $2, $3)", [
    await revisionDe(c, id),
    versionId,
    precio,
  ]);
  return id;
}

/** Añade una línea a medida a una revisión (como quien esté actuando). */
export async function anadirLinea(
  c: Client,
  revisionId: string,
  linea: {
    nombre?: string;
    precio: number;
    iva?: string;
    descuentoPorcentaje?: string | null;
    descuentoImporte?: number | null;
    categoriaId?: string;
  },
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into public.engagement_lines
       (revision_id, category_id, name, unit_price_cents, vat_rate, discount_percent, discount_amount_cents)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      revisionId,
      linea.categoriaId ?? (await categoria(c)),
      linea.nombre ?? "Servicio a medida",
      linea.precio,
      linea.iva ?? "21",
      linea.descuentoPorcentaje ?? null,
      linea.descuentoImporte ?? null,
    ],
  );
  return rows[0]!.id;
}

/**
 * Como `actAs`, pero con el claim `amr` que pone Supabase Auth cuando la sesión
 * verifica un código enviado por email (`hace` segundos). Es lo que exige la
 * firma de un contrato.
 */
export async function actAsConCodigo(c: Client, userId: string, hace = 30): Promise<void> {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - hace }],
    }),
  ]);
}

/** Firma dibujada de prueba: cabecera PNG válida y relleno. */
export const FIRMA_PNG = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(200, 1),
]).toString("base64")}`;

export async function datosFiscales(c: Client, organizationId: string) {
  await c.query(
    `insert into public.organization_billing
       (organization_id, entity_type, legal_name, tax_id, address, postal_code, city, province, country)
     values ($1, 'empresa', 'Acme Soluciones S.L.', 'b-12345678', 'Calle Mayor 1', '28001', 'Madrid', 'Madrid', 'ES')`,
    [organizationId],
  );
}

/**
 * Escenario completo hasta un contrato ENVIADO y una contratación con los datos
 * confirmados: empresa con propietario, datos fiscales, servicio, plantilla con
 * huecos, una cláusula activada y un anexo. Todo como postgres.
 */
export async function contratoEnviado(c: Client) {
  const owner = await createAuthUserLocal(c, "ana@acme.test");
  const org = (
    await c.query<{ id: string }>(
      "insert into public.organizations (name) values ('Acme') returning id",
    )
  ).rows[0]!.id;
  await c.query("insert into public.organization_members values ($1, $2, 'owner')", [org, owner]);
  await datosFiscales(c, org);
  const servicio = await crearServicio(c, "Web corporativa", { precio: 150000 });
  const engagement = await crearContratacion(c, org, servicio.versionId);
  await c.query("update public.engagements set status = 'invitada' where id = $1", [engagement]);
  await c.query("update public.engagements set status = 'datos_completos' where id = $1", [
    engagement,
  ]);

  const plantilla = (
    await c.query<{ id: string }>(
      "insert into public.contract_templates (name) values ('Prestación de servicios') returning id",
    )
  ).rows[0]!.id;
  const version = (
    await c.query<{ id: string }>(
      `insert into public.contract_template_versions (template_id, body) values ($1,
        '# Contrato {{contrato.referencia}}' || E'\n\n' ||
        'Entre {{r3zon.razon_social}} y {{cliente.razon_social}} ({{cliente.nif}}), representada por {{firmante.nombre}} ({{firmante.dni}}).' || E'\n\n' ||
        'Servicio: {{servicio.nombre}}. Precio: {{precio.base}} + IVA ({{precio.iva_porcentaje}}) = {{precio.total}}.')
       returning id`,
      [plantilla],
    )
  ).rows[0]!.id;
  const clausula = (
    await c.query<{ id: string }>(
      "insert into public.contract_clauses (title) values ('Protección de datos') returning id",
    )
  ).rows[0]!.id;
  const clausulaVersion = (
    await c.query<{ id: string }>(
      "insert into public.contract_clause_versions (clause_id, body) values ($1, 'R3ZON actuará como encargado del tratamiento.') returning id",
      [clausula],
    )
  ).rows[0]!.id;
  await c.query(
    "update public.provider_profile set legal_name = 'R3ZON S.L.', tax_id = 'B00000000'",
  );

  const contrato = (
    await c.query<{ id: string }>(
      "insert into public.contracts (engagement_id, template_version_id) values ($1, $2) returning id",
      [engagement, version],
    )
  ).rows[0]!.id;
  await c.query(
    "insert into public.contract_clause_selections (contract_id, clause_version_id) values ($1, $2)",
    [contrato, clausulaVersion],
  );
  await c.query(
    "insert into public.contract_annexes (contract_id, title, body) values ($1, 'Calendario', 'Entrega en 30 días.')",
    [contrato],
  );
  await c.query("update public.contracts set status = 'enviado' where id = $1", [contrato]);
  return { owner, org, engagement, contrato, servicio, plantilla, version };
}

async function createAuthUserLocal(c: Client, email: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '{}', now(), now())
     returning id`,
    [email],
  );
  return rows[0]!.id;
}
