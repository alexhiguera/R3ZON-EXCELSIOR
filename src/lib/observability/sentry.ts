/**
 * Configuración compartida de Sentry para navegador, servidor y edge.
 *
 * Tres reglas, y las tres vienen de errores reales del proyecto de origen:
 *
 * 1. **Sin DSN no arranca.** No hay DSN escrito en el código: cada proyecto
 *    pone el suyo en `NEXT_PUBLIC_SENTRY_DSN` (Vercel). En local no se define,
 *    así que cada `npm run dev` y cada test no manda errores al mismo panel que
 *    producción, donde una alerta tiene que significar algo.
 * 2. **No se recoge dato personal.** `dataCollection` todo a `false`, sin
 *    `setUser`, y un `beforeSend` que borra cookies, cabeceras y querystring y
 *    pasa `extra` por el mismo `redact()` que el logger.
 * 3. **El entorno no es `NODE_ENV`.** Vercel marca un preview como
 *    `production`; mezclar sus errores con los de clientes reales los entierra.
 */
import { redact } from "@/lib/logger";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
export const sentryEnabled = SENTRY_DSN.length > 0;

const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  "development";

const release =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

/** Tipo mínimo del evento; evita acoplar este módulo a la forma exacta del SDK. */
export type SentryEventLike = {
  request?: { cookies?: unknown; headers?: unknown; query_string?: unknown; data?: unknown };
  user?: unknown;
  extra?: Record<string, unknown>;
};

/** Última barrera antes de que un evento salga del proceso. */
export function scrubEvent<T extends SentryEventLike>(event: T): T {
  if (event.request) {
    event.request.cookies = undefined;
    event.request.headers = undefined;
    // El querystring lleva tokens de recuperación y el `?code=` del callback.
    event.request.query_string = undefined;
    event.request.data = undefined;
  }
  event.user = undefined;
  if (event.extra) event.extra = redact(event.extra) as Record<string, unknown>;
  return event;
}

/** Ruido que no es un fallo del producto: extensiones, cortes de red, redirecciones de Next. */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  /^Load failed$/,
  /^Failed to fetch$/,
  /^NetworkError/,
  /^AbortError/,
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
];

/**
 * Opciones de `Sentry.init`. `traces` solo en servidor y edge: son spans de
 * nuestras rutas, no perfilado de nadie. En el navegador no se abren
 * transacciones, porque eso ya es medir comportamiento y exigiría
 * consentimiento.
 */
export function sentryOptions({ traces }: { traces: boolean }) {
  return {
    dsn: SENTRY_DSN,
    environment,
    release,
    tracesSampleRate: traces ? 0.1 : 0,
    ignoreErrors: IGNORE_ERRORS,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [] as [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    },
    beforeSend: scrubEvent,
  };
}
