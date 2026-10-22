import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { type Audiencia, navegacionPara } from "@/config/navegacion";
import { project } from "@/config/project";
import { NavLinks } from "./NavLinks";

/**
 * Armazón de la zona con sesión, responsive:
 *
 * - Escritorio (`lg`): barra lateral fija con logo, secciones y usuario.
 * - Móvil y tablet: cabecera con logo y salida, y barra inferior con las
 *   secciones al alcance del pulgar. La barra inferior solo aparece con dos o
 *   más secciones: con una sola no aporta nada y quita pantalla.
 *
 * `audiencia` la decidirá el perfil del usuario cuando existan los roles
 * (Fase 1, docs/ROLES.md). Hasta entonces todo el mundo es «cliente».
 */
export function AppShell({
  children,
  email,
  audiencia = "cliente",
}: {
  children: ReactNode;
  email: string | undefined;
  audiencia?: Audiencia;
}) {
  const conBarraInferior = navegacionPara(audiencia).length > 1;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-black"
      >
        Saltar al contenido
      </a>

      {/* Escritorio: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/60 px-4 py-6 lg:flex">
        <Link
          href={project.homePath}
          aria-label={`${project.name}: inicio`}
          className="mb-8 flex items-center gap-2 px-3 text-foreground"
        >
          <Logo />
          <span className="text-xs tracking-widest text-muted uppercase">Clientes</span>
        </Link>
        <nav aria-label="Secciones" className="flex-1">
          <NavLinks audiencia={audiencia} variante="lateral" />
        </nav>
        <div className="flex flex-col gap-2 border-t border-border px-3 pt-4">
          {email && (
            <p className="truncate text-xs text-muted" title={email}>
              {email}
            </p>
          )}
          <BotonSalir />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Móvil y tablet: cabecera */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <Link
            href={project.homePath}
            aria-label={`${project.name}: inicio`}
            className="flex items-center gap-2 text-foreground"
          >
            <Logo />
            <span className="text-[10px] tracking-widest text-muted uppercase">Clientes</span>
          </Link>
          <BotonSalir compacto />
        </header>

        <main
          id="contenido"
          className={`mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10 ${conBarraInferior ? "pb-28 lg:pb-10" : ""}`}
        >
          {children}
        </main>
      </div>

      {conBarraInferior && (
        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
        >
          <NavLinks audiencia={audiencia} variante="inferior" />
        </nav>
      )}
    </div>
  );
}

/** Cerrar sesión: siempre POST (docs/AUTH.md → Logout). */
function BotonSalir({ compacto = false }: { compacto?: boolean }) {
  return (
    <form action="/auth/logout" method="post">
      <button
        type="submit"
        aria-label={compacto ? "Cerrar sesión" : undefined}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {!compacto && "Cerrar sesión"}
      </button>
    </form>
  );
}
