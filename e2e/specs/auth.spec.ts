import { expect, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { USUARIO_E2E } from "../support/usuarios.mjs";

/**
 * El recorrido mínimo que todo producto R3ZON debe mantener en verde:
 * lo público se ve sin sesión, lo protegido redirige al login, y el login da
 * acceso de verdad (sesión real contra el Supabase local, RLS incluida).
 *
 * La ruta protegida se lee de `project.homePath`: si un proyecto la cambia (y
 * renombra su carpeta), estos tests siguen valiendo sin tocarlos.
 */

const HOME = project.homePath;
/** ¿Está en el login, esperando volver a `destino`? */
const enLoginHacia = (destino: string) => (url: URL) =>
  url.pathname === "/login" && url.searchParams.get("redirect") === destino;
const en = (ruta: string) => (url: URL) => url.pathname === ruta;

test.describe("rutas sin sesión", () => {
  test("la portada pública responde 200", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test("el health check responde 200 sin sesión", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  test("una ruta protegida redirige (307) al login conservando el destino", async ({ request }) => {
    const res = await request.get(HOME, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = new URL(res.headers().location ?? "", "http://x");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe(HOME);
  });

  test("una ruta inexistente sin sesión también exige login (no filtra qué existe)", async ({
    request,
  }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
  });
});

test.describe("inicio de sesión", () => {
  test("con credenciales válidas entra en la ruta protegida que pedía", async ({ page }) => {
    await page.goto(HOME);
    await expect(page).toHaveURL(enLoginHacia(HOME));

    await page.getByLabel("Email").fill(USUARIO_E2E.email);
    await page.getByLabel("Contraseña").fill(USUARIO_E2E.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(en(HOME));
    await expect(page.getByTestId("user-email")).toHaveText(USUARIO_E2E.email);
    // El nombre viene de `profiles`, leído a través de la RLS con la sesión real.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Hola, ${USUARIO_E2E.displayName}`,
    );
  });

  test("con contraseña incorrecta muestra un error y no entra", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USUARIO_E2E.email);
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Filtrado por texto: Next.js monta su propio `role="alert"` (el anunciador
    // de rutas), así que un `getByRole("alert")` a secas encuentra dos.
    await expect(
      page.getByRole("alert").filter({ hasText: "Email o contraseña incorrectos." }),
    ).toBeVisible();
    await expect(page).toHaveURL(en("/login"));
  });

  test("cerrar sesión devuelve al login y vuelve a proteger la ruta", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USUARIO_E2E.email);
    await page.getByLabel("Contraseña").fill(USUARIO_E2E.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(en(HOME));

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(en("/login"));

    await page.goto(HOME);
    await expect(page).toHaveURL(enLoginHacia(HOME));
  });

  test("no redirige fuera del sitio aunque se lo pidan", async ({ page }) => {
    await page.goto(`/login?redirect=${encodeURIComponent("https://evil.example")}`);
    await page.getByLabel("Email").fill(USUARIO_E2E.email);
    await page.getByLabel("Contraseña").fill(USUARIO_E2E.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(en(HOME));
  });
});
