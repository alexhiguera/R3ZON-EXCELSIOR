"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Audiencia, estaActiva, navegacionPara } from "@/config/navegacion";
import { cn } from "@/lib/utils";

/**
 * Enlaces de navegación con la sección actual marcada (`aria-current="page"`).
 * Es cliente solo para leer la ruta.
 *
 * Recibe la audiencia y no la lista: las entradas llevan el icono, que es un
 * componente (una función), y una función no puede pasar de un componente de
 * servidor a uno de cliente.
 */
export function NavLinks({
  audiencia,
  variante,
}: {
  audiencia: Audiencia;
  variante: "lateral" | "inferior";
}) {
  const pathname = usePathname();
  const entradas = navegacionPara(audiencia);

  return (
    <ul className={cn(variante === "lateral" ? "flex flex-col gap-1" : "flex justify-around")}>
      {entradas.map(({ href, label, icon: Icon }) => {
        const activa = estaActiva(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "flex items-center transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                variante === "lateral"
                  ? "gap-3 rounded-xl px-3 py-2.5 text-sm"
                  : "min-w-16 flex-col gap-1 rounded-lg px-3 py-2 text-xs",
                activa
                  ? "bg-white/[0.07] text-brand"
                  : "text-muted hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
