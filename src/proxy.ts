import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy raíz de Next.js 16 (el antiguo `middleware.ts`).
 *
 * Refresca la sesión de Supabase en cada petición y deja pasar sin sesión solo
 * lo que declara `src/lib/public-paths.ts`. La lógica vive en
 * `lib/supabase/proxy.ts` para poder probarla sin arrancar Next.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo menos estáticos. `robots.txt` y `sitemap.xml` se excluyen aquí además
  // de estar en la lista pública: un crawler sin sesión no debe acabar nunca en
  // el login por pedir un fichero de SEO.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml)$).*)",
  ],
};
