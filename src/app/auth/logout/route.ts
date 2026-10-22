import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión. Solo por POST: un GET se puede disparar desde una etiqueta
 * `<img>` de cualquier web y cerrar la sesión de alguien sin que haga nada.
 *
 * 303 y no 307: tras un POST, el navegador debe pedir el login con GET.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
