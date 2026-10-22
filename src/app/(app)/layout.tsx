import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { project } from "@/config/project";
import { getCurrentUser } from "@/lib/supabase/server";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href={project.homePath} className="font-semibold">
          {project.name}
        </Link>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
