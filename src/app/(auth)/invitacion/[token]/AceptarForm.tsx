"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { aceptarInvitacion, type InvitacionState } from "./actions";

const INITIAL: InvitacionState = { error: null };

export function AceptarForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(aceptarInvitacion.bind(null, token), INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Aceptar invitación
      </Button>
    </form>
  );
}
