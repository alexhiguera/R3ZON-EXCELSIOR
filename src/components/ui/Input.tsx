"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "./Field";

/** Estilo común de los controles de formulario (Input, Select, Textarea). */
export const CONTROL = cn(
  "w-full rounded-xl border border-input bg-white/[0.04] px-4 py-2.5 text-base text-foreground",
  "placeholder:text-muted/70 sm:text-sm",
  "focus-visible:border-brand/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/40",
  "aria-invalid:border-danger disabled:opacity-60",
);

/** Enlace con su `<Field>`: id, `aria-describedby` y `aria-invalid`. */
function useEnlaceField() {
  const field = useFieldContext();
  return {
    id: field?.id,
    "aria-describedby": field?.describedBy,
    "aria-invalid": field?.invalid || undefined,
  };
}

/**
 * Campo de texto. Dentro de un `<Field>` toma de él el id, `aria-describedby` y
 * `aria-invalid`; fuera, se comporta como un `<input>` normal.
 */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...useEnlaceField()} className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...useEnlaceField()}
      className={cn(CONTROL, "appearance-auto [&>option]:bg-surface", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea {...useEnlaceField()} className={cn(CONTROL, "min-h-24", className)} {...props} />
  );
}
