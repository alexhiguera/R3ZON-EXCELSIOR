"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LONGITUD_MINIMA_CONTRASENA } from "@/lib/auth/politica";
import { crearCuenta, type InvitacionState } from "./actions";

const INITIAL: InvitacionState = { error: null };

export function CrearCuentaForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(crearCuenta.bind(null, token), INITIAL);

  if (state.info) {
    return (
      <p role="status" className="text-sm text-foreground">
        {state.info}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Nombre">
        <Input name="nombre" autoComplete="name" required maxLength={120} />
      </Field>
      <Field label="Email" hint="El mismo al que te llegó la invitación.">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" hint={`Al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={LONGITUD_MINIMA_CONTRASENA}
        />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Crear mi cuenta
      </Button>
    </form>
  );
}
