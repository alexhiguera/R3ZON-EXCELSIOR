import { expect, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { ADMIN_E2E, USUARIO_E2E } from "../support/usuarios.mjs";

/**
 * Panel de R3ZON (Fase 2), de punta a punta contra el Supabase local: catálogo,
 * alta de cliente, invitación con servicio, alta del invitado y embudo. Corre
 * en escritorio y en móvil; cada ejecución usa nombres propios.
 */

async function entrar(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === project.homePath);
}

test.describe("panel de R3ZON", () => {
  test("un cliente no puede entrar en el panel (404)", async ({ page }) => {
    await entrar(page, USUARIO_E2E);
    const r = await page.goto("/admin/clientes");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Clientes", exact: true })).toHaveCount(0);
  });

  test("del catálogo al embudo: servicio, cliente, invitación y alta del invitado", async ({
    page,
    browser,
  }, testInfo) => {
    const sufijo = `${testInfo.project.name} ${Date.now()}`;
    const servicio = `Web corporativa ${sufijo}`;
    const empresa = `Cliente ${sufijo}`;
    const email = `owner-${testInfo.project.name}-${Date.now()}@cliente.test`;

    await entrar(page, ADMIN_E2E);

    // 1. Catálogo: servicio con su tipo y precio por defecto.
    await page.goto("/admin/servicios");
    await page.getByLabel("Nombre", { exact: true }).fill(servicio);
    await page
      .getByLabel("Tipo de servicio", { exact: true })
      .selectOption({ label: "Desarrollo web" });
    await page.getByLabel("Precio (€, sin IVA)").fill("1.500");
    await page.getByLabel("Qué incluye").fill("Diseño a medida\nSEO básico");
    await page.getByRole("button", { name: "Crear servicio" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);
    await expect(page.getByTestId("version")).toHaveCount(1);

    // 2. Cliente nuevo.
    await page.goto("/admin/clientes");
    const nuevo = page.getByRole("region", { name: "Nuevo cliente", exact: true });
    await nuevo.getByLabel("Nombre de la empresa").fill(empresa);
    await nuevo.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(empresa);
    const fichaUrl = page.url();

    // 3. Invitación con servicio y precio final.
    const invitar = page.getByRole("region", { name: "Invitar a una persona" });
    await invitar.getByLabel("Email").fill(email);
    const opcion = invitar.locator("select[name=servicio] option", { hasText: servicio });
    await invitar.getByLabel("Servicio").selectOption((await opcion.getAttribute("value")) ?? "");
    await invitar.getByLabel("Precio final (€, sin IVA)").fill("1.200");
    await invitar.getByRole("button", { name: "Crear invitación" }).click();
    const enlace = (await invitar.getByTestId("texto-copiable").textContent())?.trim() ?? "";
    expect(enlace).toMatch(/\/invitacion\/[0-9a-f]{64}$/);
    await page.reload();
    await expect(page.getByTestId("invitacion")).toHaveText(email);
    // Precio pactado 1.200 € + 21 % de IVA: la ficha enseña el total.
    await expect(page.getByTestId("contratacion")).toContainText("1.452,00");
    await expect(page.getByTestId("contratacion")).toContainText("Invitada");

    // 4. El invitado crea su cuenta desde el enlace (otro navegador, sin sesión).
    const invitado = await browser.newContext();
    const pagina = await invitado.newPage();
    await pagina.goto(enlace);
    await pagina.getByLabel("Nombre").fill("Olga Owner");
    await pagina.getByLabel("Email").fill(email);
    await pagina.getByLabel("Contraseña").fill("password-e2e-123");
    await pagina.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(pagina.getByTestId("empresa")).toHaveText(empresa);
    await invitado.close();

    // 5. El equipo lo ve: persona con email y rol, y «cuenta creada» en el embudo.
    await page.goto(fichaUrl);
    await expect(page.getByTestId("persona")).toContainText("Olga Owner");
    await expect(page.getByTestId("persona")).toContainText("Propietario");
    await page.goto("/admin/contrataciones");
    const fila = page.getByTestId("fila-contratacion").filter({ hasText: empresa });
    await expect(fila).toContainText("Cuenta creada");

    // 6. Cerrar la contratación con motivo: sale del embudo (pasa a «Cerradas»).
    await fila.getByText("Cerrar contratación").click();
    await fila.getByLabel("Motivo").fill("Prueba E2E");
    await fila.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(fila).toBeHidden();
    await page.getByText(/^Cerradas \(/).click();
    await expect(page.getByTestId("fila-contratacion").filter({ hasText: empresa })).toContainText(
      "Cancelada",
    );
  });
});
