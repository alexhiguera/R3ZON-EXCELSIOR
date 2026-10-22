import { defineConfig, devices } from "@playwright/test";
import { clavesLocales } from "./scripts/lib/supabase-local.mjs";

/**
 * E2E contra la app REAL (build de producción) y el Supabase LOCAL sembrado.
 *
 * Las claves del stack se leen de `supabase status` y se inyectan SOLO en el
 * proceso del servidor de pruebas; `.env.local` no se toca. Si el stack no está
 * levantado, `clavesLocales()` falla alto y claro: un E2E que se salta por
 * falta de base sería peor que no tener E2E.
 *
 * Se prueba el build de producción (`next start`) y no `next dev` a propósito:
 * es lo que se despliega, y algunas diferencias (cabeceras, caché, CSP) solo
 * aparecen ahí.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const supabase = clavesLocales();

export default defineConfig({
  testDir: "e2e/specs",
  fullyParallel: false,
  // Un solo worker: los dos proyectos (escritorio y móvil) entran con el mismo
  // usuario, y el logout cierra la sesión en todos sus dispositivos. En paralelo,
  // el logout de uno tumbaría la sesión del otro a mitad de test.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // Escritorio y móvil: el portal se usa mucho desde el teléfono (docs/PLAN.md),
  // así que cada recorrido crítico se prueba en los dos tamaños.
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
