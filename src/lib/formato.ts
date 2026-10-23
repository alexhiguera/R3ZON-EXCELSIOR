/**
 * Formato de fechas para la interfaz (es-ES). El dinero está en `./dinero`
 * (céntimos enteros, sin coma flotante); se reexporta aquí para quien ya lo
 * importaba de este módulo.
 */

export { aCentimos, centimosATexto, euros, porcentaje } from "./dinero";

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

export function fecha(iso: string | null | undefined): string {
  return iso ? FECHA.format(new Date(iso)) : "—";
}

export function fechaHora(iso: string | null | undefined): string {
  return iso ? FECHA_HORA.format(new Date(iso)) : "—";
}
