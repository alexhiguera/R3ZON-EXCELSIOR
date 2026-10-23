import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import { esStaff, nivelActual } from "@/lib/auth/nivel";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Layout de la zona con sesión.
 *
 * El proxy ya redirige al login a quien no tiene sesión; esta comprobación es
 * la segunda línea. Si mañana alguien añade una ruta de `(app)` a la lista
 * pública por error, la página sigue sin renderizarse para un anónimo.
 * (La barrera real de los DATOS es la RLS, no ninguna de las dos.)
 *
 * El nivel solo elige la navegación (cliente o equipo de R3ZON).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const audiencia = esStaff(await nivelActual()) ? "staff" : "cliente";
  return (
    <AppShell email={user.email} audiencia={audiencia}>
      {children}
    </AppShell>
  );
}
