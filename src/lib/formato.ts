/**
 * Formato de cantidades y fechas para la interfaz (es-ES). El dinero viaja
 * SIEMPRE en céntimos enteros: nunca se hacen cuentas con decimales de coma
 * flotante. La base guarda `bigint`, que supabase-js entrega como número o
 * como texto según el tamaño: aquí se aceptan los dos.
 */

const EUROS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

/** 150000 → «1500,00 €» (con el separador de miles de es-ES a partir de 10 000). */
export function euros(centimos: number | string | bigint): string {
  return EUROS.format(Number(centimos) / 100);
}

/**
 * Texto de un formulario → céntimos. Acepta «1500», «1.500», «1500,5»,
 * «1.500,50 €». Devuelve null si no es una cantidad válida o tiene más de dos
 * decimales.
 */
export function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/[\s€]/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return null;
  const [enteros = "0", decimales = ""] = limpio.replace(/\./g, "").split(",");
  const centimos = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
  return Number.isSafeInteger(centimos) ? centimos : null;
}

/** Céntimos → texto editable en un formulario («1500,00»). */
export function centimosATexto(centimos: number | string | bigint): string {
  const n = Number(centimos);
  return `${Math.trunc(n / 100)},${String(Math.abs(n) % 100).padStart(2, "0")}`;
}

export function fecha(iso: string | null | undefined): string {
  return iso ? FECHA.format(new Date(iso)) : "—";
}

export function fechaHora(iso: string | null | undefined): string {
  return iso ? FECHA_HORA.format(new Date(iso)) : "—";
}
