import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Layout de la zona con sesión.
 *
 * El proxy ya redirige al login a quien no tiene sesión; esta comprobación es
 * la segunda línea. Si mañana alguien añade una ruta de `(app)` a la lista
 * pública por error, la página sigue sin renderizarse para un anónimo.
 * (La barrera real de los DATOS es la RLS, no ninguna de las dos.)
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Qué navegación ve (cliente o equipo de R3ZON). Es solo la interfaz: lo que
  // puede leer cada uno lo decide la RLS (docs/ARCHITECTURE.md §16).
  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();
  const audiencia = perfil && perfil.platform_role !== "client" ? "staff" : "cliente";

  return (
    <AppShell email={user.email} audiencia={audiencia}>
      {children}
    </AppShell>
  );
}
