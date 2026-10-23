import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/config/project";

/**
 * Origen (protocolo + host) de la petición actual, para construir enlaces que
 * se copian y se envían (la invitación). En local es `http://localhost:3000`,
 * en un preview su URL y en producción el dominio. Sin cabeceras utilizables,
 * el del proyecto.
 *
 * El host se valida: una cabecera `Host` manipulada no puede colar un dominio
 * con caracteres raros en un enlace que luego se envía a un cliente.
 */
export async function origenDeLaPeticion(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return siteUrl();
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
