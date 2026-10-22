import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

/**
 * Páginas de acceso (login y, más adelante, invitación y recuperación): tarjeta
 * centrada sobre el halo violeta de r3zon.com. En móvil la tarjeta ocupa el
 * ancho y el contenido queda arriba, donde no lo tapa el teclado.
 */
export function AuthLayout({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-aurora flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center sm:py-16">
      <Link
        href="https://r3zon.com"
        aria-label="R3ZON, ir a la web"
        className="mb-8 text-foreground transition-[filter] hover:drop-shadow-[0_0_12px_rgba(229,73,255,0.55)]"
      >
        <Logo className="w-[120px] lg:w-[136px]" />
      </Link>
      <main className="surface-card w-full max-w-md rounded-3xl bg-surface/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          {subtitulo && <p className="text-sm text-muted">{subtitulo}</p>}
        </div>
        <div className="flex flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
