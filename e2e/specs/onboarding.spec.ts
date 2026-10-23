import { expect, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { codigoEnviadoA } from "../support/correo.mjs";
import { ADMIN_E2E } from "../support/usuarios.mjs";

/**
 * Fase 3 de punta a punta, contra el Supabase local real (hook, RLS, triggers
 * y el email del código en Mailpit): el equipo prepara plantilla, cláusula y
 * servicio; da de alta al cliente con invitación; el cliente crea su cuenta y
 * da sus datos; el equipo prepara y envía el contrato; el cliente lo firma con
 * el código del email y descarga el PDF; el equipo lo ve firmado.
 */

async function entrar(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === project.homePath);
}

async function elegirOpcion(page: Page, etiqueta: string, texto: string) {
  const select = page.getByLabel(etiqueta);
  const valor = await select.locator("option", { hasText: texto }).getAttribute("value");
  await select.selectOption(valor ?? "");
}

test("alta completa: invitación, datos, contrato y firma con código", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const sufijo = `${testInfo.project.name}-${Date.now()}`;
  const empresa = `Construcciones ${sufijo}`;
  const email = `gerente-${sufijo}@cliente.test`;
  const plantilla = `Prestación ${sufijo}`;
  const clausula = `Protección de datos ${sufijo}`;
  const servicio = `Ecommerce ${sufijo}`;

  // 1. El equipo prepara la herramienta de contratos y el servicio.
  await entrar(page, ADMIN_E2E);
  await page.goto("/admin/contratos");
  const nuevaPlantilla = page.getByRole("region", { name: "Nueva plantilla" });
  await nuevaPlantilla.getByLabel("Nombre").fill(plantilla);
  await nuevaPlantilla
    .getByLabel("Texto")
    .fill(
      "# Contrato de {{servicio.nombre}}\n\nEntre **{{cliente.razon_social}}** ({{cliente.nif}}), representada por {{firmante.nombre}}, y R3ZON.\n\n## Precio\n\n{{precio.base}} + IVA = {{precio.total}}.",
    );
  await nuevaPlantilla.getByRole("button", { name: "Crear plantilla" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(plantilla);

  await page.goto("/admin/contratos");
  const nuevaClausula = page.getByRole("region", { name: "Nueva cláusula" });
  await nuevaClausula.getByLabel("Título").fill(clausula);
  await nuevaClausula.getByLabel("Texto").fill("R3ZON actuará como encargado del tratamiento.");
  await nuevaClausula.getByRole("button", { name: "Crear cláusula" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(clausula);

  await page.goto("/admin/servicios");
  await page.getByLabel("Nombre", { exact: true }).fill(servicio);
  await page.getByLabel("Precio (€, sin IVA)").fill("2.000");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(servicio);

  // 2. Cliente nuevo e invitación de una vez.
  await page.goto("/admin/clientes");
  const alta = page.getByRole("region", { name: "Nuevo cliente con invitación" });
  await alta.getByLabel("Nombre de la empresa").fill(empresa);
  await alta.getByLabel("Email").fill(email);
  await elegirOpcion(page, "Servicio", servicio);
  await alta.getByRole("button", { name: "Crear cliente e invitar" }).click();
  const enlace = (await alta.getByTestId("texto-copiable").textContent())?.trim() ?? "";
  expect(enlace).toMatch(/\/invitacion\/[0-9a-f]{64}$/);
  await alta.getByRole("link", { name: /Ir a la ficha del cliente/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(empresa);
  const fichaUrl = page.url();

  // 3. El cliente crea su cuenta y da los datos de su empresa.
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(enlace);
  await cliente.getByLabel("Nombre").fill("Gema Gerente");
  await cliente.getByLabel("Email").fill(email);
  await cliente.getByLabel("Contraseña").fill("password-e2e-123");
  await cliente.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(cliente.getByTestId("servicio-cliente")).toContainText(servicio);
  await cliente.getByRole("link", { name: "Continuar" }).click();
  await expect(cliente.getByRole("heading", { name: /Gracias por/ })).toBeVisible();
  await cliente.getByRole("link", { name: "Empezar" }).click();

  await cliente.getByLabel("Razón social o nombre completo").fill(`${empresa} S.L.`);
  await cliente.getByLabel("NIF / CIF").fill("B12345675");
  await cliente.getByLabel("Dirección fiscal").fill("Calle Mayor 1");
  await cliente.getByLabel("Código postal").fill("28001");
  await cliente.getByLabel("Población").fill("Madrid");
  await cliente.getByRole("button", { name: "Guardar y continuar" }).click();
  // Un CIF con el dígito de control mal se detecta antes de llegar al contrato.
  await expect(cliente.getByRole("alert").filter({ hasText: "CIF no es válido" })).toBeVisible();
  await cliente.getByLabel("NIF / CIF").fill("B12345674");
  await cliente.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(
    cliente.getByRole("heading", { name: "Estamos preparando tu contrato" }),
  ).toBeVisible();

  // 4. El equipo prepara el contrato y lo envía.
  await page.goto(fichaUrl);
  await page.getByTestId("contratacion").getByRole("link").click();
  await elegirOpcion(page, "Plantilla", plantilla);
  await page.getByRole("button", { name: "Crear contrato" }).click();
  await page.getByLabel(new RegExp(clausula)).check();
  await page.getByRole("button", { name: "Guardar cláusulas" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Cláusulas guardadas." })).toBeVisible();
  await page.getByLabel("Título del anexo").fill("Calendario");
  await page.getByLabel("Texto del anexo").fill("Entrega en 30 días.");
  await page.getByRole("button", { name: "Añadir anexo" }).click();
  await expect(page.getByTestId("texto-contrato")).toContainText("Anexo 1. Calendario");
  await expect(page.getByTestId("texto-contrato")).toContainText(clausula);
  await page.getByRole("button", { name: "Enviar al cliente" }).click();
  await expect(page.getByText("Pendiente de firma")).toBeVisible();

  // 5. El cliente revisa, pide el código y firma.
  await cliente.reload();
  const texto = cliente.getByTestId("texto-contrato");
  await expect(texto).toContainText(`${empresa} S.L.`);
  await expect(texto).toContainText("B12345674");
  await expect(texto).toContainText("2.000,00 € + IVA = 2.420,00 €.");
  const desde = Date.now();
  await cliente.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(cliente.getByText(/Te hemos enviado un código/)).toBeVisible();
  const codigo = await codigoEnviadoA(email, desde);

  await cliente.getByLabel("Nombre y apellidos").fill("Gema Gerente Ruiz");
  await cliente.getByLabel("DNI o NIE").fill("12345678Z");
  await cliente.getByLabel("Cargo en la empresa").fill("Administradora");
  await cliente.getByRole("button", { name: "Usar mi nombre" }).click();
  await cliente.getByLabel("Código del email").fill(codigo);
  await cliente.getByLabel(/He leído el contrato/).check();
  await cliente.getByRole("button", { name: "Firmar contrato" }).click();
  await expect(cliente.getByRole("heading", { level: 1 })).toHaveText("¡Enhorabuena!");

  const pdf = await cliente.request.get(
    (await cliente.getByTestId("descargar-contrato").getAttribute("href")) ?? "",
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // 6. El equipo lo ve firmado; la vista de cliente enseña lo mismo que ve él.
  await page.reload();
  await expect(page.getByText("Firmado", { exact: true })).toBeVisible();
  await expect(page.getByTestId("texto-contrato")).toContainText("Gema Gerente Ruiz");
  await page.goto(`${fichaUrl}/vista`);
  await expect(page.getByRole("note")).toContainText("como la ve el cliente");
  await expect(page.getByTestId("servicio-cliente")).toContainText("Firmada");
  await expect(page.getByRole("link", { name: "Continuar" })).toHaveCount(0);
});
