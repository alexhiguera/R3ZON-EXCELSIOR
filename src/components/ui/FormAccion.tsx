"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useEffect,
  useRef,
} from "react";
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
  /** A dónde seguir después («Ir a la ficha del cliente»). */
  ir?: { href: string; label: string } | null;
};

export const ESTADO_INICIAL: EstadoForm = { error: null };

/**
 * Formulario conectado a una Server Action. Los campos llegan como `children`
 * (pueden pintarse en el servidor); este componente solo pone el estado: botón
 * ocupado, error, éxito y enlace a copiar. El error se anuncia (`role=alert`).
 *
 * Conserva lo escrito si la acción falla. React 19 vacía un formulario con
 * `action` después de CADA envío, también cuando la Server Action devuelve un
 * error: un CIF mal escrito borraba todo el formulario (lo cazó un E2E). Por
 * eso el envío va por `onSubmit` + `startTransition` (React no lo vacía) y el
 * formulario solo se vacía cuando la acción sale bien. El atributo `action` se
 * queda para que funcione sin JavaScript.
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
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok && !estado.error) formulario.current?.reset();
  }, [estado]);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => accionForm(datos));
  }

  return (
    <form
      ref={formulario}
      action={accionForm}
      onSubmit={enviar}
      className={cn("flex flex-col gap-4", className)}
      noValidate
    >
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
      {estado.ir && (
        <Link
          href={estado.ir.href}
          className="text-sm text-brand underline-offset-4 hover:underline"
        >
          {estado.ir.label} →
        </Link>
      )}
      <div>
        <Button type="submit" variant={variante} loading={pendiente}>
          {boton}
        </Button>
      </div>
    </form>
  );
}
