import { expect, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { ADMIN_E2E } from "../support/usuarios.mjs";

/**
 * Cliente que YA PAGÓ por transferencia y YA FIRMÓ fuera (informe de R3ZON,
 * 2026-10-23): el equipo crea la contratación sin invitar, desmarca «firma en
 * el portal», registra el cobro externo e invita. El cliente solo completa sus
 * datos: no se le pide firmar ni pagar. El equipo la activa.
 */

async function entrar(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === project.homePath);
}

test("cliente existente ya pagado y firmado fuera: entra sin firmar ni pagar", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const sufijo = `${testInfo.project.name}-${Date.now()}`;
  const empresa = `Histórico ${sufijo}`;
  const servicio = `Mantenimiento ${sufijo}`;
  const email = `historico-${sufijo}@cliente.test`;

  await entrar(page, ADMIN_E2E);

  // Servicio de 1.000 € + 21 % IVA = 1.210 €.
  await page.goto("/admin/servicios");
  await page.getByLabel("Nombre", { exact: true }).fill(servicio);
  await page.getByLabel("Precio (€, sin IVA)").fill("1.000");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);

  // Cliente y contratación en borrador, sin firma en el portal.
  await page.goto("/admin/clientes");
  const nuevo = page.getByRole("region", { name: "Nuevo cliente", exact: true });
  await nuevo.getByLabel("Nombre de la empresa").fill(empresa);
  await nuevo.getByRole("button", { name: "Crear cliente" }).click();
  const contratacion = page.getByRole("region", { name: /Nueva contratación/ });
  const opcion = contratacion.locator("select[name=servicio] option", { hasText: servicio });
  await contratacion
    .getByLabel("Servicio")
    .selectOption((await opcion.getAttribute("value")) ?? "");
  await contratacion.getByLabel(/Firma el contrato en el portal/).uncheck();
  await contratacion.getByRole("button", { name: "Crear contratación" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);

  // Cobros externos: dos transferencias que suman el total.
  const cobro = page.getByTestId("seccion-cobro");
  await expect(cobro).toContainText("Sin pagar");
  for (const [importe, ref] of [
    ["600", "TRF-1"],
    ["610", "TRF-2"],
  ] as const) {
    await cobro.getByLabel("Importe (€, IVA incluido)").fill(importe);
    await cobro.getByLabel("Referencia o concepto").fill(ref);
    await cobro.getByRole("button", { name: "Registrar cobro" }).click();
    await expect(cobro.getByText("Cobro registrado.")).toBeVisible();
  }
  await expect(cobro).toContainText("Pagado");
  await expect(cobro.getByTestId("movimiento")).toHaveCount(2);
  // Un cobro de más no entra: la base lo impide.
  await cobro.getByLabel("Importe (€, IVA incluido)").fill("1");
  await cobro.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("superaría el total");

  // Invitación.
  await page.getByLabel("Email de quien completa el alta").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const enlace = (await page.getByTestId("texto-copiable").textContent())?.trim() ?? "";
  expect(enlace).toMatch(/\/invitacion\/[0-9a-f]{64}$/);
  const urlContratacion = page.url();

  // El cliente: cuenta, datos y listo. Ni contrato ni pago.
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(enlace);
  await cliente.getByLabel("Nombre").fill("Héctor Histórico");
  await cliente.getByLabel("Email").fill(email);
  await cliente.getByLabel("Contraseña").fill("password-e2e-123");
  await cliente.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(cliente.getByTestId("servicio-cliente")).toContainText("Pagado");
  await cliente.getByRole("link", { name: "Continuar" }).click();
  await expect(cliente.getByRole("navigation", { name: "Progreso" })).not.toContainText("Contrato");
  await cliente.getByRole("link", { name: "Empezar" }).click();
  await cliente.getByLabel("Razón social o nombre completo").fill(`${empresa} S.L.`);
  await cliente.getByLabel("NIF / CIF").fill("B12345674");
  await cliente.getByLabel("Dirección fiscal").fill("Calle Mayor 1");
  await cliente.getByLabel("Código postal").fill("48001");
  await cliente.getByLabel("Población").fill("Bilbao");
  await cliente.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(cliente.getByRole("heading", { level: 1 })).toHaveText("¡Enhorabuena!");
  await expect(cliente.getByTestId("paso-listo")).toContainText("No tienes nada pendiente");
  await cliente.goto("/inicio");
  await expect(cliente.getByRole("link", { name: "Continuar" })).toHaveCount(0);

  // El equipo la pone en marcha.
  await page.goto(urlContratacion);
  await page.getByRole("button", { name: "Activar contratación" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Activa");
});
