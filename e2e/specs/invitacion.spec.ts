import { expect, type Page, test } from "@playwright/test";
import {
  crearInvitacionLocal,
  tokenGuardadoEnAuth,
} from "../../scripts/lib/invitaciones-locales.mjs";
import { clavesLocales } from "../../scripts/lib/supabase-local.mjs";
import { project } from "../../src/config/project";
import { USUARIO_E2E } from "../support/usuarios.mjs";

/**
 * Alta solo por invitación (docs/AUTH.md), de punta a punta contra el Supabase
 * local con su hook `before_user_created` real. Corre en escritorio y en móvil:
 * cada test genera emails propios para no pisarse entre proyectos.
 */

const unico = (testInfo: { project: { name: string } }, nombre: string) =>
  `${nombre}-${testInfo.project.name}-${Date.now()}@cliente.test`;

async function crearCuenta(page: Page, datos: { nombre: string; email: string; password: string }) {
  await page.getByLabel("Nombre").fill(datos.nombre);
  await page.getByLabel("Email").fill(datos.email);
  await page.getByLabel("Contraseña").fill(datos.password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
}

test.describe("invitación", () => {
  test("crea la cuenta con la invitación y entra en su empresa", async ({ page }, testInfo) => {
    const email = unico(testInfo, "ana");
    const empresa = `Acme ${testInfo.project.name} ${Date.now()}`;
    const { token } = await crearInvitacionLocal({ email, empresa });

    await page.goto(`/invitacion/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Te damos la bienvenida");
    await crearCuenta(page, { nombre: "Ana Cliente", email, password: "password-e2e-123" });

    await expect(page).toHaveURL((url) => url.pathname === project.homePath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Ana Cliente");
    await expect(page.getByTestId("empresa")).toHaveText(empresa);
    // El token solo viaja para que el hook lo compruebe: no queda guardado.
    expect(await tokenGuardadoEnAuth(email)).toBe(false);
  });

  test("no crea la cuenta con un email distinto al invitado", async ({ page }, testInfo) => {
    const { token } = await crearInvitacionLocal({
      email: unico(testInfo, "invitada"),
      empresa: `Acme ${Date.now()}`,
    });

    await page.goto(`/invitacion/${token}`);
    await crearCuenta(page, {
      nombre: "Intruso",
      email: unico(testInfo, "intruso"),
      password: "password-e2e-123",
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "No hemos podido usar esta invitación" }),
    ).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname.startsWith("/invitacion/"));
  });

  test("un enlace ya usado no sirve para crear otra cuenta", async ({ page }, testInfo) => {
    const email = unico(testInfo, "luis");
    const { token } = await crearInvitacionLocal({ email, empresa: `Acme ${Date.now()}` });

    await page.goto(`/invitacion/${token}`);
    await crearCuenta(page, { nombre: "Luis", email, password: "password-e2e-123" });
    await expect(page).toHaveURL((url) => url.pathname === project.homePath);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");

    await page.goto(`/invitacion/${token}`);
    await crearCuenta(page, {
      nombre: "Otro",
      email: unico(testInfo, "otro"),
      password: "password-e2e-123",
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "No hemos podido usar esta invitación" }),
    ).toBeVisible();
  });

  test("un enlace con formato incorrecto se explica sin formulario", async ({ page }) => {
    await page.goto("/invitacion/no-es-un-token");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Enlace no válido");
    await expect(page.getByRole("button", { name: "Crear mi cuenta" })).toHaveCount(0);
  });

  test("una cuenta existente acepta la invitación de otra empresa", async ({ page }, testInfo) => {
    const empresa = `Gestoría ${testInfo.project.name} ${Date.now()}`;
    const { token } = await crearInvitacionLocal({
      email: USUARIO_E2E.email,
      empresa,
      rol: "billing",
    });

    await page.goto(`/login?redirect=${encodeURIComponent(`/invitacion/${token}`)}`);
    await page.getByLabel("Email").fill(USUARIO_E2E.email);
    await page.getByLabel("Contraseña").fill(USUARIO_E2E.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aceptar invitación");
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page).toHaveURL((url) => url.pathname === project.homePath);
    await expect(page.getByTestId("empresa").filter({ hasText: empresa })).toBeVisible();
  });
});

test.describe("sin invitación no hay alta", () => {
  test("la API de Auth rechaza un alta directa, saltándose la web", async ({
    request,
  }, testInfo) => {
    const { url, publishableKey } = clavesLocales();
    const r = await request.post(`${url}/auth/v1/signup`, {
      headers: { apikey: publishableKey, "content-type": "application/json" },
      data: { email: unico(testInfo, "colado"), password: "password-e2e-123" },
    });
    expect(r.status()).toBe(403);
  });

  test("el login no ofrece crear cuenta", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /crear cuenta|registr/i })).toHaveCount(0);
  });
});
