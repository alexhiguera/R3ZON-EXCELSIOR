import { MODULOS } from "@/modulos/registro";
import type { Audiencia, EntradaNavegacion } from "@/modulos/tipos";

export type { Audiencia, EntradaNavegacion } from "@/modulos/tipos";

/**
 * Secciones de la zona con sesión: la suma de lo que declara cada módulo
 * (src/modulos/registro.ts). Añadir un apartado no toca el layout.
 *
 * `audiencia` dice quién VE el enlace. Es experiencia de usuario: quien no deba
 * entrar en una sección lo impide la RLS (y, para /admin, el proxy y su
 * layout), nunca que el enlace no aparezca.
 *
 * Solo se listan rutas que existen: tests/unit/navegacion.test.ts falla si una
 * entrada apunta a una página que no está en src/app/(app)/.
 */
export const NAVEGACION: readonly EntradaNavegacion[] = MODULOS.flatMap((m) => m.navegacion);

export function navegacionPara(audiencia: Audiencia): EntradaNavegacion[] {
  return NAVEGACION.filter((e) => e.audiencia.includes(audiencia));
}

/** ¿Está activa la entrada para esta ruta? Por segmento: `/proyectos` no activa `/proyectos-x`. */
export function estaActiva(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
