/**
 * Qué rutas se ven SIN sesión. Es la única fuente de verdad: la consume el
 * proxy (`src/proxy.ts`) y la prueba `tests/public-paths.test.ts`.
 *
 * Todo lo que no esté aquí exige sesión. Añadir una página pública nueva sin
 * tocar esta lista la deja detrás del login, y eso solo lo ve quien pide la URL
 * sin cookie: de ahí la comprobación con `curl` de CLAUDE.md.
 *
 * Sin dependencias a propósito: corre en cada petición.
 */

/** Rutas públicas exactas. */
export const PUBLIC_EXACT: ReadonlySet<string> = new Set([
  "/",
  "/login",
  "/robots.txt",
  "/sitemap.xml",
  "/api/health",
]);

/**
 * Prefijos públicos. Coinciden por SEGMENTO: `/auth` casa con `/auth/callback`
 * pero no con `/authfalso`. Comparar con `startsWith` a secas dejó pasar rutas
 * como `/preciosXYZ` en el proyecto de origen.
 */
export const PUBLIC_PREFIXES: readonly string[] = ["/auth", "/legal"];

export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || matchesPrefix(pathname, PUBLIC_PREFIXES);
}
