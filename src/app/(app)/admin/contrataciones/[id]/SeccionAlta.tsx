import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input } from "@/components/ui/Input";
import { ESTADOS_COBRO } from "@/modulos/cobros";
import { resumenCobro } from "@/modulos/cobros/servidor";
import { puedeActivarse } from "@/modulos/contrataciones";
import type { DetalleContratacion } from "@/modulos/contrataciones/servidor";
import { Interruptores } from "../Interruptores";
import { accionActivar, accionInterruptores, accionInvitarContratacion } from "./actions";

/**
 * Lo que el equipo decide del alta (T-26, T-27): invitar o reenviar el enlace,
 * qué hace el cliente en el portal (firmar, pagar) y activar la contratación.
 * Activar es decisión de R3ZON: el panel solo avisa del estado de cobro.
 */
export async function SeccionAlta({ e }: { e: DetalleContratacion }) {
  const invitable = e.status === "borrador" || e.status === "invitada";
  const cerrada = ["finalizada", "cancelada", "rescindida"].includes(e.status);
  const activable = puedeActivarse(e.status, e.requires_signature);
  const cobro = activable ? await resumenCobro(e.id) : null;
  const avisoCobro =
    cobro?.ok && cobro.datos && cobro.datos.status !== "pagado"
      ? `Ojo: el cobro está «${ESTADOS_COBRO[cobro.datos.status].etiqueta}».`
      : null;

  return (
    <Card className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Alta</h2>

      {invitable && (
        <section aria-labelledby="invitar" className="flex flex-col gap-3">
          <h3 id="invitar" className="text-sm font-medium">
            {e.invitada ? "Reenviar la invitación" : "Invitar al cliente"}
          </h3>
          {e.invitada && (
            <p className="text-xs text-muted">
              {e.invitacion_aceptada
                ? "Ya creó su cuenta."
                : "Hay una invitación enviada. Reenviar crea un enlace nuevo y anula el anterior."}
            </p>
          )}
          <FormAccion
            accion={accionInvitarContratacion.bind(null, e.id)}
            boton={e.invitada ? "Reenviar invitación" : "Crear invitación"}
            variante="secondary"
            etiquetaEnlace="Enlace de invitación (cópialo ahora: no se vuelve a mostrar)"
          >
            <Field label="Email de quien completa el alta">
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
          </FormAccion>
        </section>
      )}

      {!cerrada && (
        <FormAccion
          accion={accionInterruptores.bind(null, e.id)}
          boton="Guardar"
          variante="secondary"
        >
          <Interruptores
            firma={e.requires_signature}
            pago={e.requires_payment}
            firmaBloqueada={!["borrador", "invitada", "datos_completos"].includes(e.status)}
          />
        </FormAccion>
      )}

      {activable && (
        <section aria-labelledby="activar" className="flex flex-col gap-3">
          <h3 id="activar" className="text-sm font-medium">
            Poner en marcha
          </h3>
          <p className="text-sm text-muted">
            {e.requires_signature ? "El contrato está firmado." : "Los datos están completos."}{" "}
            {avisoCobro ?? "El cobro está al día."}
          </p>
          <FormAccion accion={accionActivar.bind(null, e.id)} boton="Activar contratación">
            <Field label="Nota (opcional)" hint="Queda en el historial.">
              <Input name="motivo" maxLength={500} />
            </Field>
          </FormAccion>
        </section>
      )}
    </Card>
  );
}
