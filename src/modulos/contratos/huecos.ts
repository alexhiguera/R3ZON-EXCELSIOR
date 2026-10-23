/**
 * Huecos que admiten plantillas, cláusulas y anexos. La lista que MANDA está
 * en la base (`contract_placeholder_names()`): un texto con un hueco
 * desconocido no se guarda. Esta copia es para ayudar a quien escribe la
 * plantilla; tests/db/contratos-huecos.test.ts comprueba que coinciden.
 */
export const HUECOS = [
  { grupo: "Cliente", nombre: "cliente.razon_social", ayuda: "Razón social o nombre del autónomo" },
  { grupo: "Cliente", nombre: "cliente.nif", ayuda: "NIF/CIF" },
  { grupo: "Cliente", nombre: "cliente.direccion", ayuda: "Dirección fiscal completa" },
  { grupo: "Cliente", nombre: "cliente.tipo", ayuda: "Persona jurídica o autónomo" },
  { grupo: "Cliente", nombre: "cliente.email_facturacion", ayuda: "Email de facturación" },
  { grupo: "Firmante", nombre: "firmante.nombre", ayuda: "Nombre de quien firma (al firmar)" },
  { grupo: "Firmante", nombre: "firmante.dni", ayuda: "DNI/NIE de quien firma" },
  { grupo: "Firmante", nombre: "firmante.cargo", ayuda: "Cargo en la empresa" },
  { grupo: "Firmante", nombre: "firmante.email", ayuda: "Email de su cuenta" },
  { grupo: "Servicio", nombre: "servicio.nombre", ayuda: "Nombre del servicio" },
  { grupo: "Servicio", nombre: "servicio.resumen", ayuda: "Resumen del servicio" },
  { grupo: "Servicio", nombre: "servicio.incluye", ayuda: "Lista de lo que incluye" },
  { grupo: "Servicio", nombre: "servicio.version", ayuda: "Versión de las condiciones" },
  { grupo: "Precio", nombre: "precio.base", ayuda: "Precio sin IVA" },
  { grupo: "Precio", nombre: "precio.iva_porcentaje", ayuda: "Tipo de IVA" },
  { grupo: "Precio", nombre: "precio.iva", ayuda: "Importe del IVA" },
  { grupo: "Precio", nombre: "precio.total", ayuda: "Total con IVA" },
  { grupo: "Precio", nombre: "precio.modalidades", ayuda: "Modalidades de pago ofrecidas" },
  { grupo: "Contrato", nombre: "contrato.condiciones", ayuda: "Condiciones particulares" },
  { grupo: "Contrato", nombre: "contrato.fecha", ayuda: "Fecha (la de la firma)" },
  { grupo: "Contrato", nombre: "contrato.referencia", ayuda: "Referencia del contrato" },
  { grupo: "R3ZON", nombre: "r3zon.razon_social", ayuda: "Razón social de R3ZON" },
  { grupo: "R3ZON", nombre: "r3zon.nif", ayuda: "NIF de R3ZON" },
  { grupo: "R3ZON", nombre: "r3zon.direccion", ayuda: "Dirección de R3ZON" },
  { grupo: "R3ZON", nombre: "r3zon.email", ayuda: "Email de contacto de R3ZON" },
] as const;

export type Hueco = (typeof HUECOS)[number]["nombre"];

const NOMBRES: ReadonlySet<string> = new Set(HUECOS.map((h) => h.nombre));

/** Huecos de un texto que no existen (para avisar antes de guardar). */
export function huecosDesconocidos(texto: string): string[] {
  const encontrados = [...texto.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]!);
  return [...new Set(encontrados.filter((n) => !NOMBRES.has(n)))].sort();
}

/** Marca que deja la base en un hueco sin valor: «[pendiente: x]». */
export const MARCA_PENDIENTE = /\[pendiente: ([a-z_.]+)\]/g;
