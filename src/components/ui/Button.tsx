import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border bg-background text-foreground hover:bg-surface",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  /** Deshabilita el botón y lo anuncia como ocupado a los lectores de pantalla. */
  loading?: boolean;
};

/**
 * Botón base. `type="button"` por defecto: un botón dentro de un formulario que
 * no declara tipo es `submit`, y eso envía formularios por accidente.
 */
export function Button({
  variant = "primary",
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
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
