/**
 * Identificadores fiscales españoles (NIF, NIE, CIF) con su carácter de
 * control. Es EXPERIENCIA DE USUARIO: detecta una errata antes de que llegue al
 * contrato. La base solo comprueba el formato; un NIF extranjero (país distinto
 * de ES) no pasa por aquí.
 */

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Quita espacios, puntos y guiones, y pasa a mayúsculas. */
export function normalizarNif(valor: string): string {
  return valor.toUpperCase().replace(/[\s.-]/g, "");
}

/** DNI (8 cifras + letra) o NIE (X/Y/Z + 7 cifras + letra). */
export function esDniONieValido(valor: string): boolean {
  const v = normalizarNif(valor);
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(v);
  if (!m) return false;
  const [, prefijo, cifras, letra] = m;
  if (prefijo && cifras!.length !== 7) return false;
  if (!prefijo && cifras!.length !== 8) return false;
  const numero = Number(`${prefijo ? "XYZ".indexOf(prefijo) : ""}${cifras}`);
  return LETRAS_DNI[numero % 23] === letra;
}

/** CIF de una persona jurídica: letra + 7 cifras + control (cifra o letra). */
export function esCifValido(valor: string): boolean {
  const v = normalizarNif(valor);
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  const [, letra, cifras, control] = m;
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    let d = Number(cifras![i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  const digito = (10 - (suma % 10)) % 10;
  const letraControl = "JABCDEFGHI"[digito]!;
  // Unas entidades llevan letra de control; otras, cifra; otras, cualquiera.
  if ("PQRSNW".includes(letra!)) return control === letraControl;
  if ("ABEH".includes(letra!)) return control === String(digito);
  return control === String(digito) || control === letraControl;
}

/** NIF válido para el tipo de entidad (en España). */
export function esNifValido(valor: string, tipo: "empresa" | "autonomo"): boolean {
  return tipo === "autonomo"
    ? esDniONieValido(valor)
    : esCifValido(valor) || esDniONieValido(valor);
}
