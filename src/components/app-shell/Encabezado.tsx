import Link from "next/link";
import type { ReactNode } from "react";

/** Encabezado de página: migas opcionales, título, descripción y acciones. */
export function Encabezado({
  titulo,
  descripcion,
  volver,
  acciones,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  volver?: { href: string; label: string };
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {volver && (
          <Link href={volver.href} className="text-xs text-muted hover:text-foreground">
            ← {volver.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold break-words sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="text-sm text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
