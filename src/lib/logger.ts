/**
 * Logger estructurado mínimo, sin dependencias.
 *
 * - Una línea JSON por evento: Vercel la recoge ya parseada en Runtime Logs.
 * - Redacta las claves que suenan a secreto antes de escribir nada.
 * - `debug` se silencia en producción salvo `LOG_LEVEL=debug`.
 *
 *   const log = logger("auth/callback");
 *   log.error("exchange_failed", { status: 400 });
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /(token|secret|password|authorization|api[_-]?key|cookie)/i;

/**
 * Sustituye por `[REDACTED]` el valor de cualquier clave que suene a secreto,
 * recursivamente y con tope de profundidad.
 *
 * Se exporta porque Sentry aplica exactamente la misma regla antes de enviar un
 * evento: dos listas de «qué es sensible» que nadie mantiene a la vez es cómo un
 * token acaba en un sitio y no en el otro.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

function minLevel(): Level {
  const fromEnv = process.env.LOG_LEVEL as Level | undefined;
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function emit(scope: string, level: Level, event: string, extra?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    scope,
    event,
    ...(extra ? (redact(extra) as Record<string, unknown>) : {}),
  });
  if (level === "error" || level === "warn") console.error(line);
  // biome-ignore lint/suspicious/noConsole: punto único de salida del logger.
  else console.log(line);
}

export type Logger = Record<Level, (event: string, extra?: Record<string, unknown>) => void>;

export function logger(scope: string): Logger {
  return {
    debug: (event, extra) => emit(scope, "debug", event, extra),
    info: (event, extra) => emit(scope, "info", event, extra),
    warn: (event, extra) => emit(scope, "warn", event, extra),
    error: (event, extra) => emit(scope, "error", event, extra),
  };
}
