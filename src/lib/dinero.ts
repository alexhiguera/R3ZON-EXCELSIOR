/**
 * Dinero en la app: SIEMPRE céntimos enteros (como Stripe para EUR).
 * 1 € = 100; 10,50 € = 1050; 1.500,00 € = 150000.
 *
 * La app no calcula importes: totales, IVA, descuentos e hitos los calcula la
 * base, que es la única que redondea (docs/ARCHITECTURE.md §18). Aquí solo se
 * TRADUCE: texto de un formulario → céntimos, y céntimos → texto. Ni
 * `parseFloat` ni divisiones decimales: el texto se analiza dígito a dígito con
 * BigInt, y para mostrar se separan euros y céntimos con aritmética entera.
 */

/** Importe máximo que admite la base (1.000.000.000,00 €). */
export const MAX_CENTIMOS = 100_000_000_000n;

const IMPORTE = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Texto de un formulario (en euros, formato español) → céntimos. Acepta
 * «1500», «1.500», «1500,5», «1.500,50 €». Devuelve null si no es una cantidad
 * válida, es negativa, tiene más de dos decimales o supera el máximo.
 */
export function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/[\s €]/g, "");
  if (!IMPORTE.test(limpio)) return null;
  const [enteros = "0", decimales = ""] = limpio.replace(/\./g, "").split(",");
  const centimos = BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, "0"));
  return centimos <= MAX_CENTIMOS ? Number(centimos) : null;
}

/** Separa miles con punto: «1500» → «1.500». */
function miles(entero: bigint): string {
  return entero.toString().replace(/\B(?=(\d{3})+$)/g, ".");
}

function partes(centimos: number | string | bigint): {
  signo: string;
  euros: bigint;
  cent: string;
} {
  const n = BigInt(centimos);
  const abs = n < 0n ? -n : n;
  return { signo: n < 0n ? "-" : "", euros: abs / 100n, cent: String(abs % 100n).padStart(2, "0") };
}

/** 150000 → «1.500,00 €». Separador de miles siempre, como los contratos. */
export function euros(centimos: number | string | bigint): string {
  const { signo, euros: e, cent } = partes(centimos);
  return `${signo}${miles(e)},${cent} €`;
}

/** Céntimos → texto editable en un formulario («1500,00»), sin separador de miles. */
export function centimosATexto(centimos: number | string | bigint): string {
  const { signo, euros: e, cent } = partes(centimos);
  return `${signo}${e},${cent}`;
}

const PORCENTAJE = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;

/**
 * Texto de un formulario → porcentaje para la base (`numeric(5,2)`), como
 * texto exacto con punto: «21» → «21», «10,5» → «10.5». Entre 0 y 100, con dos
 * decimales como mucho. Null si no es válido. Nunca pasa por un `number`.
 */
export function aPorcentaje(texto: string): string | null {
  const m = PORCENTAJE.exec(texto.replace(/[\s%]/g, ""));
  if (!m) return null;
  const entero = BigInt(m[1]!);
  const decimales = m[2] ?? "";
  if (entero > 100n || (entero === 100n && /[1-9]/.test(decimales))) return null;
  return decimales ? `${entero}.${decimales}` : String(entero);
}

/**
 * Porcentaje de la base → texto: 21 → «21 %», "10.50" → «10,5 %». Solo
 * formatea (la base lo manda como número o texto); no hace cuentas.
 */
export function porcentaje(valor: number | string): string {
  const [entero, decimales = ""] = String(valor).split(".");
  const d = decimales.replace(/0+$/, "");
  return `${entero}${d ? `,${d}` : ""} %`;
}
