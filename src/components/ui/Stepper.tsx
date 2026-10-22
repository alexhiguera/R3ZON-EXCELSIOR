import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { id: string; label: string };

/**
 * Progreso de un asistente por pasos (onboarding, aceptar una propuesta).
 *
 * Es una lista ordenada: el lector de pantalla anuncia «paso N de M», y el paso
 * actual lleva `aria-current="step"`. En móvil solo se ve el paso actual con su
 * número; desde `sm` se ve la secuencia completa.
 */
export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  const actual = steps[current];
  return (
    <nav aria-label="Progreso">
      <p className="text-sm text-muted sm:hidden">
        Paso {current + 1} de {steps.length}
        {actual && <span className="text-foreground"> · {actual.label}</span>}
      </p>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((step, i) => {
          const estado = i < current ? "hecho" : i === current ? "actual" : "pendiente";
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={estado === "actual" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 text-sm whitespace-nowrap",
                  estado === "pendiente" ? "text-muted" : "text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    estado === "hecho" && "border-primary bg-primary text-primary-foreground",
                    estado === "actual" && "border-brand text-brand shadow-glow",
                    estado === "pendiente" && "border-border text-muted",
                  )}
                >
                  {estado === "hecho" ? <Check className="size-4" /> : i + 1}
                </span>
                {step.label}
                {estado === "hecho" && <span className="sr-only">(completado)</span>}
              </span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn("h-px flex-1", i < current ? "bg-primary/60" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
