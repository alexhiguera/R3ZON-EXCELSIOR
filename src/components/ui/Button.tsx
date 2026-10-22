import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

/*
 * Estilo de los botones de r3zon.com: píldora, magenta con resplandor para la
 * acción principal, línea fina para la secundaria. Una pantalla tiene, como
 * mucho, UNA acción principal.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover hover:shadow-glow-strong",
  secondary: "border border-border bg-white/[0.04] text-foreground hover:bg-white/[0.08]",
  ghost: "text-muted hover:bg-white/5 hover:text-foreground",
};

const SIZES: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Deshabilita el botón y lo anuncia como ocupado a los lectores de pantalla. */
  loading?: boolean;
};

/**
 * Botón base. `type="button"` por defecto: un botón dentro de un formulario que
 * no declara tipo es `submit`, y eso envía formularios por accidente.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium",
        "transition-[background-color,box-shadow,color] duration-200 ease-out-quint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
