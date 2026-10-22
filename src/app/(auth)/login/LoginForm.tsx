"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { type LoginState, signIn } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ redirectTo }: { redirectTo: string | undefined }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Iniciar sesión
      </Button>
    </form>
  );
}
