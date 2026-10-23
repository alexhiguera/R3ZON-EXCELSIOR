import { logger } from "@/lib/logger";

/**
 * Resultado de una lectura de datos de un módulo. Las consultas de los módulos
 * NO lanzan: devuelven `{ ok: false }` y registran el fallo. Así un módulo que
 * falla (una tabla que no responde, una policy mal escrita) muestra «no
 * disponible» en su bloque y no se lleva por delante la página ni los demás
 * módulos (docs/ARCHITECTURE.md §21).
 */
export type Resultado<T> = { ok: true; datos: T } | { ok: false };

/** Resultado de una escritura: si falla, con un mensaje que se puede enseñar. */
export type ResultadoAccion<T = null> = { ok: true; datos: T } | { ok: false; error: string };

type ErrorSupabase = { code?: string; message?: string };
type RespuestaSupabase<T> = { data: T | null; error: ErrorSupabase | null };

/**
 * Convierte la respuesta de supabase-js en un `Resultado`, registrando el
 * error con el módulo y la operación. Nunca registra los datos: solo el código.
 */
export async function leer<T>(
  modulo: string,
  operacion: string,
  consulta: PromiseLike<RespuestaSupabase<T>>,
): Promise<Resultado<T>> {
  try {
    const { data, error } = await consulta;
    if (error || data === null) {
      logger(`modulo/${modulo}`).error(`${operacion}_failed`, { code: error?.code ?? "sin_datos" });
      return { ok: false };
    }
    return { ok: true, datos: data };
  } catch (err) {
    logger(`modulo/${modulo}`).error(`${operacion}_threw`, { name: (err as Error).name });
    return { ok: false };
  }
}

/**
 * Igual que `leer`, para escrituras. Los errores de regla de negocio que lanza
 * la base (`P0001`, escritos en español para el usuario por los triggers) se
 * enseñan tal cual; cualquier otro, con `mensajeGenerico`, sin detalles
 * internos.
 */
export async function escribir<T>(
  modulo: string,
  operacion: string,
  consulta: PromiseLike<RespuestaSupabase<T>>,
  mensajeGenerico: string,
): Promise<ResultadoAccion<NonNullable<T>>> {
  try {
    const { data, error } = await consulta;
    if (error) {
      logger(`modulo/${modulo}`).warn(`${operacion}_failed`, { code: error.code });
      return { ok: false, error: mensajeDeError(error, mensajeGenerico) };
    }
    // Sin error, `data` solo es null en las funciones que no devuelven nada
    // (void): quien las llama no usa `datos`.
    return { ok: true, datos: data as NonNullable<T> };
  } catch (err) {
    logger(`modulo/${modulo}`).error(`${operacion}_threw`, { name: (err as Error).name });
    return { ok: false, error: mensajeGenerico };
  }
}

/** Mensaje para el usuario a partir de un error de Postgres/PostgREST. */
export function mensajeDeError(error: ErrorSupabase, mensajeGenerico: string): string {
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "23505") return "Ya existe un registro con esos datos.";
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  return mensajeGenerico;
}
