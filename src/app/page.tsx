import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { project } from "@/config/project";

/**
 * Portada pública de clientes.r3zon.com. El área es solo para clientes, así
 * que no vende nada: dice dónde estás y lleva a entrar (o a la web, si no eres
 * cliente).
 */
export default function HomePage() {
  return (
    <div className="bg-aurora flex min-h-dvh flex-col px-5 sm:px-8">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center lg:h-[72px]">
        <Link href="https://r3zon.com" aria-label="R3ZON, ir a la web" className="text-foreground">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 pb-16">
        <p className="text-xs tracking-[0.2em] text-lavender uppercase">Área de clientes</p>
        <h1 className="text-4xl font-semibold sm:text-5xl lg:text-6xl">
          Tu proyecto con R3ZON, <span className="text-gradient">en un solo sitio</span>.
        </h1>
        <p className="max-w-xl text-base text-muted sm:text-lg">{project.description}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={project.homePath}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition-[background-color,box-shadow] duration-200 hover:bg-primary-hover hover:shadow-glow-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Entrar
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="https://r3zon.com"
            className="inline-flex items-center justify-center rounded-full border border-border bg-white/[0.04] px-6 py-3 text-foreground transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Ir a r3zon.com
          </Link>
        </div>
      </main>
    </div>
  );
}
