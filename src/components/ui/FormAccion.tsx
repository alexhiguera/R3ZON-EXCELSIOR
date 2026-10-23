"use client";

import { type ReactNode, useActionState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { CopiarTexto } from "./CopiarTexto";

/** Estado que devuelve una Server Action usada con `FormAccion`. */
export type EstadoForm = {
  error: string | null;
  /** Mensaje de éxito («Cliente archivado»). */
  ok?: string | null;
  /** Enlace que se enseña UNA vez para copiarlo (invitaciones). */
  enlace?: string | null;
};

export const ESTADO_INICIAL: EstadoForm = { error: null };

/**
 * Formulario conectado a una Server Action. Los campos llegan como `children`
 * (pueden pintarse en el servidor); este componente solo pone el estado: botón
 * ocupado, error, éxito y enlace a copiar. El error se anuncia (`role=alert`).
 */
export function FormAccion({
  accion,
  boton,
  children,
  variante = "primary",
  className,
  etiquetaEnlace = "Enlace",
}: {
  accion: (previo: EstadoForm, datos: FormData) => Promise<EstadoForm>;
  boton: string;
  children?: ReactNode;
  variante?: "primary" | "secondary" | "ghost";
  className?: string;
  etiquetaEnlace?: string;
}) {
  const [estado, accionForm, pendiente] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={accionForm} className={cn("flex flex-col gap-4", className)} noValidate>
      {children}
      {estado.error && (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-success">
          {estado.ok}
        </p>
      )}
      {estado.enlace && <CopiarTexto texto={estado.enlace} etiqueta={etiquetaEnlace} />}
      <div>
        <Button type="submit" variant={variante} loading={pendiente}>
          {boton}
        </Button>
      </div>
    </form>
  );
}
