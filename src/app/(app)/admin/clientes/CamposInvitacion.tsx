import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { euros } from "@/lib/formato";
import { ETIQUETA_ROL } from "@/modulos/organizaciones";
import { listarServicios } from "@/modulos/servicios/servidor";
import { Interruptores } from "../contrataciones/Interruptores";

/**
 * Campos de una invitación: email, servicio (opcional), precio final y
 * condiciones; y el rol, que solo cuenta sin servicio (con servicio, la persona
 * entra como propietaria para completar el alta). Los usan la ficha del cliente
 * y el alta de cliente con invitación.
 */
export async function CamposInvitacion({
  conRol = true,
  conEmail = true,
  servicioObligatorio = false,
  sinServicio = "Sin servicio (solo acceso)",
}: {
  conRol?: boolean;
  /** Sin email: para crear una contratación en borrador e invitar después. */
  conEmail?: boolean;
  servicioObligatorio?: boolean;
  /** Texto de la opción «sin servicio» del catálogo. */
  sinServicio?: string;
}) {
  const servicios = await listarServicios();
  const disponibles = servicios.ok ? servicios.datos.filter((s) => s.version_id) : [];

  return (
    <>
      {conEmail && (
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
      )}
      <Field
        label="Servicio"
        hint={
          servicios.ok
            ? undefined
            : "El catálogo no está disponible ahora: solo se puede invitar sin servicio."
        }
      >
        <Select name="servicio" defaultValue="">
          {!servicioObligatorio && <option value="">{sinServicio}</option>}
          {disponibles.map((s) => (
            <option key={s.id} value={s.version_id ?? ""}>
              {s.name} · {euros(s.price_cents ?? 0)} + IVA
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Precio final (€, sin IVA)" hint="Vacío: el del catálogo. Solo con servicio.">
        <Input name="precio" inputMode="decimal" placeholder="1.500,00" />
      </Field>
      <Field
        label="Condiciones particulares"
        hint="Descuentos, plazos… Pasan al contrato. Solo con servicio."
      >
        <Textarea name="condiciones" maxLength={4000} rows={3} />
      </Field>
      <Interruptores />
      {conRol && (
        <Field
          label="Rol"
          hint="Solo sin servicio: con servicio, la persona entra como propietaria."
        >
          <Select name="rol" defaultValue="owner">
            {Object.entries(ETIQUETA_ROL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </>
  );
}
