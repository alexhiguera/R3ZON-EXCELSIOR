import { expect, type Locator, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { ADMIN_E2E } from "../support/usuarios.mjs";

/**
 * Configuración económica previa a la invitación (requisito de R3ZON,
 * 2026-10-23): varios servicios a medida con descuento e IVA distintos, pagos
 * en hitos, revisión del total, invitación; el cliente ve y acepta esas
 * cifras; cobro por hitos; un cambio de condiciones que el cliente acepta.
 * Todos los importes los calcula la base, en céntimos.
 *
 *   Tienda online   1.000,00 € − 10 % = 900,00 € base, IVA 21 % = 189,00 €
 *   Formación         200,00 €          200,00 € base, IVA 10 % =  20,00 €
 *   Total 1.309,00 € en 3 pagos: 436,33 + 436,33 + 436,34
 */

async function entrar(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === project.homePath);
}

/** Abre un <details> por su resumen si aún está cerrado. */
async function abrir(ambito: Locator, resumen: string) {
  const s = ambito.locator("summary", { hasText: resumen }).first();
  const d = s.locator("xpath=..");
  if ((await d.getAttribute("open")) === null) await s.click();
  return d;
}

async function lineaAMedida(
  ambito: Locator,
  l: { tipo: string; nombre: string; precio: string; iva: string; descuento?: string },
) {
  const form = await abrir(ambito, "Añadir un servicio a medida");
  await form.getByLabel("Tipo de servicio").selectOption({ label: l.tipo });
  await form.getByLabel("Nombre del servicio").fill(l.nombre);
  await form.getByLabel("Precio (€, sin IVA)").fill(l.precio);
  await form.getByLabel("IVA (%)").fill(l.iva);
  if (l.descuento) {
    await form.getByLabel("Descuento", { exact: true }).selectOption({ label: "En %" });
    await form.getByLabel("Valor del descuento").fill(l.descuento);
  }
  await form.getByRole("button", { name: "Añadir servicio" }).click();
  await expect(ambito.getByTestId("linea-editable").filter({ hasText: l.nombre })).toBeVisible();
}

test("condiciones a medida: se fijan antes de invitar, el cliente las acepta y se cobran por hitos", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const sufijo = `${testInfo.project.name}-${Date.now()}`;
  const empresa = `Medida ${sufijo}`;
  const email = `medida-${sufijo}@cliente.test`;

  await entrar(page, ADMIN_E2E);

  // 1. Cliente y contratación en borrador, sin servicio todavía y sin firma en el portal.
  await page.goto("/admin/clientes");
  const nuevo = page.getByRole("region", { name: "Nuevo cliente", exact: true });
  await nuevo.getByLabel("Nombre de la empresa").fill(empresa);
  await nuevo.getByRole("button", { name: "Crear cliente" }).click();
  const nueva = page.getByRole("region", { name: /Nueva contratación/ });
  await nueva.getByLabel(/Firma el contrato en el portal/).uncheck();
  await nueva.getByRole("button", { name: "Crear contratación" }).click();
  const condiciones = page.getByTestId("seccion-condiciones");
  await expect(condiciones).toBeVisible();
  // Sin condiciones no se invita.
  await expect(page.getByRole("note").filter({ hasText: "Antes de invitar" })).toBeVisible();

  // 2-4. Servicios, descuento, IVA y la base calcula los totales.
  await lineaAMedida(condiciones, {
    tipo: "Comercio electrónico",
    nombre: "Tienda online",
    precio: "1.000",
    iva: "21",
    descuento: "10",
  });
  await lineaAMedida(condiciones, {
    tipo: "Otros servicios personalizados",
    nombre: "Formación",
    precio: "200",
    iva: "10",
  });
  await expect(condiciones.getByTestId("total-condiciones")).toContainText("1.309,00");
  await condiciones.getByLabel("Dividir el total en pagos iguales").fill("3");
  await condiciones.getByRole("button", { name: "Dividir" }).click();
  await expect(condiciones.getByTestId("hito-editable")).toHaveCount(3);
  await expect(condiciones.getByTestId("hitos")).toContainText("436,33");
  await expect(condiciones.getByTestId("hitos")).toContainText("436,34");

  // 5-6. Revisión e invitación.
  await expect(page.getByTestId("resumen-invitacion")).toContainText("1.309,00");
  await expect(page.getByTestId("resumen-invitacion")).toContainText("en 3 pagos");
  await page.getByLabel("Email de quien completa el alta").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const enlace = (await page.getByTestId("texto-copiable").textContent())?.trim() ?? "";
  const urlContratacion = page.url();

  // 7-9. El cliente ve los servicios y precios fijados y los acepta al dar sus datos.
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(enlace);
  await cliente.getByLabel("Nombre").fill("Marta Medida");
  await cliente.getByLabel("Email").fill(email);
  await cliente.getByLabel("Contraseña").fill("password-e2e-123");
  await cliente.getByRole("button", { name: "Crear mi cuenta" }).click();
  await cliente.getByRole("link", { name: "Continuar" }).click();
  const bienvenida = cliente.getByTestId("resumen-condiciones");
  await expect(bienvenida.getByTestId("linea")).toHaveCount(2);
  await expect(bienvenida).toContainText("Tienda online");
  await expect(bienvenida).toContainText("descuento 100,00");
  await expect(bienvenida).toContainText("189,00");
  await expect(bienvenida.getByTestId("total-condiciones")).toContainText("1.309,00");
  await cliente.getByRole("link", { name: "Empezar" }).click();
  await expect(cliente.getByTestId("aceptacion-condiciones")).toContainText("1.309,00");
  await cliente.getByLabel("Razón social o nombre completo").fill(`${empresa} S.L.`);
  await cliente.getByLabel("NIF / CIF").fill("B12345674");
  await cliente.getByLabel("Dirección fiscal").fill("Calle Mayor 1");
  await cliente.getByLabel("Código postal").fill("48001");
  await cliente.getByLabel("Población").fill("Bilbao");
  await cliente.getByRole("button", { name: "Guardar y continuar" }).click();

  // 10. Solo se le pide el primer pago (el importe lo calcula la base).
  await expect(cliente.getByTestId("paso-pago")).toBeVisible();
  await expect(cliente.getByTestId("exigible-cliente")).toContainText("436,33");
  await expect(cliente.getByTestId("pendiente-cliente")).toContainText("1.309,00");

  // Cobro del primer hito fuera del portal y liberación del segundo.
  await page.goto(urlContratacion);
  const cobro = page.getByTestId("seccion-cobro");
  await cobro.getByLabel("Importe (€, IVA incluido)").fill("436,33");
  await cobro.getByLabel("Referencia o concepto").fill("TRF-1");
  await cobro.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobro.getByTestId("exigible")).toContainText("0,00");
  await cobro.getByRole("button", { name: "Liberar «Pago 2 de 3»" }).click();
  await expect(cobro.getByTestId("exigible")).toContainText("436,33");

  // Cambio de condiciones: la formación pasa a 300 €.
  await page.getByLabel("Motivo del cambio").fill("Más horas de formación");
  await page.getByRole("button", { name: "Preparar un cambio" }).click();
  const cambio = page.getByTestId("cambio-condiciones");
  const formacion = cambio.getByTestId("linea-editable").filter({ hasText: "Formación" });
  const editar = await abrir(formacion, "Editar o quitar");
  await editar.getByLabel("Precio (€, sin IVA)").fill("300");
  await editar.getByRole("button", { name: "Guardar servicio" }).click();
  // 900 + 189 + 300 + 30 = 1.419,00
  await expect(cambio.getByTestId("total-condiciones")).toContainText("1.419,00");
  await cambio.getByRole("button", { name: "Proponer al cliente" }).click();
  await expect(cambio).toContainText("Esperando a que el cliente lo acepte");

  // El cliente lo ve en su inicio y lo acepta.
  await cliente.goto("/inicio");
  await cliente
    .getByTestId("aviso-cambio")
    .getByRole("link", { name: "Revisar el cambio" })
    .click();
  await expect(cliente.getByTestId("cambio-propuesto")).toContainText("1.419,00");
  await cliente.getByRole("button", { name: "Aceptar el cambio" }).click();
  await expect(cliente.getByText("Cambio aceptado")).toBeVisible();

  // Las condiciones vigentes son las nuevas; las anteriores quedan como sustituidas.
  await page.goto(urlContratacion);
  await expect(page.getByTestId("seccion-condiciones")).toContainText("Revisión 2");
  await expect(
    page.getByTestId("seccion-condiciones").getByTestId("total-condiciones"),
  ).toContainText("1.419,00");
  const anteriores = await abrir(page.getByTestId("seccion-condiciones"), "Revisiones anteriores");
  await expect(anteriores.getByTestId("revision-anterior")).toContainText("Sustituida");
  // Lo ya pagado no se vuelve a pedir: liberados 2 pagos de 473,00 = 946,00 − 436,33.
  await expect(page.getByTestId("seccion-cobro").getByTestId("exigible")).toContainText("509,67");
});
