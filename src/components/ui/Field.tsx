"use client";

import { createContext, type ReactNode, useContext, useId } from "react";

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Lo consume `Input` para quedar enlazado a su etiqueta, ayuda y error. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export type FieldProps = {
  label: string;
  /** Texto de ayuda permanente bajo el campo. */
  hint?: string;
  /** Mensaje de error. Si existe, el campo se marca `aria-invalid`. */
  error?: string;
  children: ReactNode;
};

/**
 * Etiqueta + control + ayuda + error, enlazados por id sin que quien lo usa
 * tenga que inventarse ninguno. Es la pieza por la que pasa todo formulario:
 * un fallo de accesibilidad aquí es un fallo en todas las pantallas a la vez,
 * por eso tiene su test con jest-axe.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext>
  );
}
