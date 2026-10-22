import { sentryEnabled, sentryOptions } from "@/lib/observability/sentry";

/**
 * Arranque de Sentry en el navegador.
 *
 * Se carga con `import()` y solo si hay DSN: el SDK pesa ~80 KB gzip y no debe
 * entrar en el bundle inicial de todas las páginas. El precio es que un error
 * lanzado antes de que termine de cargar no se ve. El proyecto de origen lo
 * cubrió con un búfer de errores tempranos; aquí no se hace hasta que haga
 * falta (docs/mejoras.md).
 *
 * Arranca sin esperar a ningún banner de cookies: un error es interés legítimo
 * (mantener el servicio), y eso solo se sostiene porque no se recoge dato
 * personal (ver `lib/observability/sentry.ts`).
 */
if (sentryEnabled && typeof window !== "undefined") {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init(sentryOptions({ traces: false }));
  });
}
