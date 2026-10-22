import { sentryEnabled, sentryOptions } from "@/lib/observability/sentry";

/**
 * Se ejecuta una vez por proceso, antes que el resto de la app.
 *
 * El SDK se importa de forma dinámica y solo si hay DSN: sin DSN (local, CI,
 * un proyecto recién creado) Sentry no se carga en absoluto.
 */
export async function register() {
  if (!sentryEnabled) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    ...sentryOptions({ traces: true }),
    // La integración `Console` convierte cada línea del logger en un
    // breadcrumb: sería enviar a Sentry justo lo que `redact()` evita escribir.
    integrations: (defaults) => defaults.filter((i) => i.name !== "Console"),
  });
}

/**
 * Errores lanzados al renderizar Server Components. Sin este hook no llegan a
 * Sentry: Next los convierte en el `digest` que muestra `error.tsx`.
 */
export async function onRequestError(...args: unknown[]) {
  if (!sentryEnabled) return;
  const Sentry = await import("@sentry/nextjs");
  return (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
}
