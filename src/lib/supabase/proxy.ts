import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { isPublicPath } from "@/lib/public-paths";

export function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

/**
 * Refresca la sesión de Supabase y aplica el gate de rutas.
 *
 * - Ruta pública → pasa sin preguntar a Supabase (no cuesta una llamada).
 * - Ruta de API → pasa: cada handler responde 401 por su cuenta. Un 307 a una
 *   página HTML no le sirve a quien llama a una API.
 * - Resto → exige usuario; sin él, 307 a `/login?redirect=<ruta>`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  if (isPublicPath(pathname) || isApiRoute(pathname)) return response;

  // Atajo: sin ninguna cookie de Supabase no hay sesión que validar.
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSessionCookie) return redirectToLogin(request);

  const env = publicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // No meter código entre la creación del cliente y `getUser()`: es la llamada
  // que renueva el token, y la documentación de @supabase/ssr avisa de que
  // cualquier cosa en medio produce cierres de sesión aleatorios.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectToLogin(request);
  return response;
}
