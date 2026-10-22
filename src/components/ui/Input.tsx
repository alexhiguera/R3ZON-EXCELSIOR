"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "./Field";

/**
 * Campo de texto. Dentro de un `<Field>` toma de él el id, `aria-describedby` y
 * `aria-invalid`; fuera, se comporta como un `<input>` normal.
 */
export function Input({ className, ...props }: ComponentProps<"input">) {
  const field = useFieldContext();
  return (
    <input
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        "rounded-xl border border-input bg-white/[0.04] px-4 py-2.5 text-base text-foreground",
        "placeholder:text-muted/70 sm:text-sm",
        "focus-visible:border-brand/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/40",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
