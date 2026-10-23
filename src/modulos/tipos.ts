import type { LucideIcon } from "lucide-react";

/** Quién VE un enlace. Es experiencia de usuario: quién puede entrar lo decide la RLS. */
export type Audiencia = "cliente" | "staff";

export type EntradaNavegacion = {
  href: string;
  label: string;
  icon: LucideIcon;
  audiencia: readonly Audiencia[];
};

/**
 * Lo que un módulo de negocio declara de sí mismo (docs/ARCHITECTURE.md §15 y
 * §21). Se registra en src/modulos/registro.ts.
 */
export type DefinicionModulo = {
  /** Igual que su carpeta en src/modulos/. */
  id: string;
  nombre: string;
  /** Secciones que añade al menú. Cada `href` tiene que existir como página. */
  navegacion: readonly EntradaNavegacion[];
};
