import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta: la superficie de r3zon.com (blanco casi transparente sobre la tinta
 * con línea fina). Es un contenedor sin semántica propia: si agrupa una sección
 * con título, quien la usa pone el `<section>` y el encabezado.
 */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("surface-card rounded-2xl p-5 sm:p-6", className)} {...props} />;
}
