import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/project";

/**
 * Páginas públicas indexables con su `lastModified` LITERAL.
 *
 * Nunca `new Date()`: movería la fecha de todo el sitio en cada despliegue y el
 * buscador acabaría ignorando la señal. Quien cambia el contenido visible de
 * una de estas páginas actualiza su fecha aquí en el mismo commit (CLAUDE.md).
 */
const PAGES: { path: string; lastModified: string }[] = [{ path: "/", lastModified: "2026-09-23" }];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map(({ path, lastModified }) => ({ url: `${base}${path}`, lastModified }));
}
