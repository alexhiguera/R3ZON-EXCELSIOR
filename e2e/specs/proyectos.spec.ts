import { expect, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { ADMIN_E2E } from "../support/usuarios.mjs";

/**
 * Proyecto y briefing (Fase 5, T-32/T-33): R3ZON define el briefing del
 * servicio; al completar el alta nace el proyecto; el cliente lo rellena
 * (con «no aplica» en lo opcional); el equipo pide cambios y valida.
 */

async function entrar(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === project.homePath);
}

test("briefing: del alta al proyecto en diseño", async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  const sufijo = `${testInfo.project.name}-${Date.now()}`;
  const empresa = `Briefing ${sufijo}`;
  const servicio = `Web briefing ${sufijo}`;
  const email = `briefing-${sufijo}@cliente.test`;

  await entrar(page, ADMIN_E2E);

  // Servicio con su plantilla de briefing.
  await page.goto("/admin/servicios");
  await page.getByLabel("Nombre", { exact: true }).fill(servicio);
  await page.getByLabel("Precio (€, sin IVA)").fill("1.000");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);
  const plantilla = page.getByTestId("plantilla-briefing");
  for (const [etiqueta, tipo, seccion, obligatorio] of [
    ["Color principal", "Color", "Marca", true],
    ["Sobre vosotros", "Texto", "Contenido", true],
    ["Web actual", "Enlace", "Contenido", false],
  ] as const) {
    await plantilla.getByLabel("Qué se pide").fill(etiqueta);
    await plantilla.getByLabel("Tipo").selectOption({ label: tipo });
    await plantilla.getByLabel("Sección").fill(seccion);
    if (!obligatorio) await plantilla.getByLabel(/Obligatorio/).uncheck();
    await plantilla.getByRole("button", { name: "Añadir al briefing" }).click();
    await expect(plantilla.getByRole("listitem").filter({ hasText: etiqueta })).toBeVisible();
  }

  // Cliente y contratación sin firma ni pago en el portal, e invitación.
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
  await contratacion.getByLabel(/Paga en el portal/).uncheck();
  await contratacion.getByRole("button", { name: "Crear contratación" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);
  await page.getByLabel("Email de quien completa el alta").fill(email);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  const enlace = (await page.getByTestId("texto-copiable").textContent())?.trim() ?? "";

  // El cliente completa el alta y el proyecto nace.
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(enlace);
  await cliente.getByLabel("Nombre").fill("Bea Briefing");
  await cliente.getByLabel("Email").fill(email);
  await cliente.getByLabel("Contraseña").fill("password-e2e-123");
  await cliente.getByRole("button", { name: "Crear mi cuenta" }).click();
  await cliente.getByRole("link", { name: "Continuar" }).click();
  await cliente.getByRole("link", { name: "Empezar" }).click();
  await cliente.getByLabel("Razón social o nombre completo").fill(`${empresa} S.L.`);
  await cliente.getByLabel("NIF / CIF").fill("B12345674");
  await cliente.getByLabel("Dirección fiscal").fill("Calle Mayor 1");
  await cliente.getByLabel("Código postal").fill("48001");
  await cliente.getByLabel("Población").fill("Bilbao");
  await cliente.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(cliente.getByRole("heading", { level: 1 })).toHaveText("¡Enhorabuena!");
  await cliente.getByRole("link", { name: "Empezar el briefing" }).click();
  await expect(cliente.getByTestId("progreso-briefing")).toHaveText("0 % completado");

  // Color: uno mal escrito no entra (lo rechaza la base, no solo el navegador).
  const color = cliente.getByRole("region", { name: "Color principal" });
  await color.getByLabel("Color en hexadecimal").evaluate((el) => el.removeAttribute("pattern"));
  await color.getByLabel("Color en hexadecimal").fill("rojo");
  await color.getByRole("button", { name: "Enviar" }).click();
  await expect(color.getByRole("alert")).toContainText("hexadecimal");
  await color.getByLabel("Color en hexadecimal").fill("#1A2B3C");
  await color.getByRole("button", { name: "Enviar" }).click();
  await expect(color.getByText("Enviado", { exact: true })).toBeVisible();

  const texto = cliente.getByRole("region", { name: "Sobre vosotros" });
  await texto.getByLabel("Tu respuesta").fill("Somos una empresa de Bilbao.");
  await texto.getByRole("button", { name: "Enviar" }).click();
  const web = cliente.getByRole("region", { name: "Web actual" });
  await web.getByRole("button", { name: "No aplica" }).click();
  await expect(cliente.getByTestId("progreso-briefing")).toHaveText("100 % completado");

  // El equipo revisa: valida el color y pide cambios en el texto.
  await page.goto("/admin/proyectos");
  const fila = page.getByTestId("fila-proyecto").filter({ hasText: empresa });
  await expect(fila).toContainText("2 por revisar");
  await fila.getByRole("link").click();
  const colorAdmin = page.getByRole("region", { name: "Color principal" });
  await expect(colorAdmin).toContainText("#1a2b3c");
  await colorAdmin.getByRole("button", { name: "Validar" }).click();
  await expect(colorAdmin.getByText("Validado", { exact: true })).toBeVisible();
  const textoAdmin = page.getByRole("region", { name: "Sobre vosotros" });
  await textoAdmin.getByLabel("Qué hay que cambiar").fill("Contadnos también a qué os dedicáis.");
  await textoAdmin.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(textoAdmin.getByText("Cambios pedidos", { exact: true })).toBeVisible();

  // El cliente ve la nota, corrige; lo validado ya no lo puede tocar.
  await cliente.reload();
  await expect(texto.getByRole("note")).toContainText("a qué os dedicáis");
  await expect(color.getByRole("button", { name: /Enviar|Guardar/ })).toHaveCount(0);
  await texto.getByLabel("Tu respuesta").fill("Somos una empresa de Bilbao que fabrica bicis.");
  await texto.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(texto.getByText("Enviado", { exact: true })).toBeVisible();

  // El equipo mueve el proyecto.
  await page.reload();
  await page.getByLabel("Pasar a").selectOption({ label: "Diseño" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Diseño");
  await cliente.goto("/inicio");
  await expect(cliente.getByTestId("proyecto-cliente")).toContainText("Diseño");
});
