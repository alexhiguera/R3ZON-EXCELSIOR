import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { esStaff, nivelActual } from "@/lib/auth/nivel";

/**
 * Panel de R3ZON: solo equipo. Tres capas (docs/ARCHITECTURE.md §16):
 *   1. el proxy exige sesión;
 *   2. este layout responde 404 a quien no es del equipo (no revela que el
 *      panel existe);
 *   3. la RLS, que es la barrera real: aunque un cliente llegara a una página
 *      de aquí, las consultas no le devolverían nada que no sea suyo.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!esStaff(await nivelActual())) notFound();
  return children;
}
