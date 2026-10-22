import { House, type LucideIcon } from "lucide-react";
import { project } from "./project";

/**
 * Secciones de la zona con sesión. Añadir un apartado es añadir una entrada
 * aquí (docs/ARCHITECTURE.md §15), no tocar el layout.
 *
 * `audiencia` dice quién VE el enlace. Es experiencia de usuario: quien no deba
 * entrar en una sección lo impide la RLS (y, para /admin, el proxy y su
 * layout), nunca que el enlace no aparezca.
 *
 * Solo se listan rutas que existen: tests/unit/navegacion.test.ts falla si una
 * entrada apunta a una página que no está en src/app/(app)/.
 */
export type Audiencia = "cliente" | "staff";

export type EntradaNavegacion = {
  href: string;
  label: string;
  icon: LucideIcon;
  audiencia: readonly Audiencia[];
};

export const NAVEGACION: readonly EntradaNavegacion[] = [
  { href: project.homePath, label: "Inicio", icon: House, audiencia: ["cliente", "staff"] },
];

export function navegacionPara(audiencia: Audiencia): EntradaNavegacion[] {
  return NAVEGACION.filter((e) => e.audiencia.includes(audiencia));
}

/** ¿Está activa la entrada para esta ruta? Por segmento: `/proyectos` no activa `/proyectos-x`. */
export function estaActiva(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
