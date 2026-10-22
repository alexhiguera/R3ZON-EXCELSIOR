import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-white/[0.05] text-muted",
  brand: "border-primary/30 bg-primary/10 text-brand",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

/**
 * Etiqueta de estado («Pendiente de firma», «Pagado»…). El texto es el que
 * informa: el color solo lo refuerza, así que nunca se usa un Badge vacío.
 */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
