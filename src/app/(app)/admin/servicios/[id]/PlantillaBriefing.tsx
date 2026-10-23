import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { porSeccion, TIPOS_ELEMENTO } from "@/modulos/proyectos";
import { plantillaBriefing } from "@/modulos/proyectos/servidor";
import { accionAnadirBriefing, accionQuitarBriefing } from "./actions-briefing";

/**
 * Plantilla de briefing del servicio: lo que se le pedirá al cliente en cada
 * proyecto. Se copia al proyecto cuando nace (T-32): cambiarla no toca los que
 * ya existen. La edita admin (RLS). Sin ficheros todavía (T-33) y nunca
 * contraseñas (T-07).
 */
export async function PlantillaBriefing({
  serviceId,
  esAdmin,
}: {
  serviceId: string;
  esAdmin: boolean;
}) {
  const r = await plantillaBriefing(serviceId);
  if (!r.ok) return <BloqueNoDisponible nombre="La plantilla de briefing" />;

  return (
    <Card className="flex flex-col gap-5" data-testid="plantilla-briefing">
      <div>
        <h2 className="text-lg font-semibold">Briefing</h2>
        <p className="text-sm text-muted">
          Lo que se le pide al cliente en cada proyecto de este servicio. Cambiarlo no afecta a los
          proyectos que ya existen. Nunca pidas contraseñas ni accesos aquí.
        </p>
      </div>

      {r.datos.length === 0 ? (
        <p className="text-sm text-muted">Sin elementos: los proyectos nacerán sin briefing.</p>
      ) : (
        porSeccion(r.datos).map(([seccion, elementos]) => (
          <div key={seccion} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{seccion}</h3>
            <ul className="flex flex-col gap-2">
              {elementos.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex flex-col text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      {e.label}
                      <Badge>{TIPOS_ELEMENTO[e.kind]}</Badge>
                      {!e.required && <Badge>Opcional</Badge>}
                    </span>
                    {e.help && <span className="text-xs text-muted">{e.help}</span>}
                  </span>
                  {esAdmin && (
                    <FormAccion
                      accion={accionQuitarBriefing.bind(null, serviceId, e.id)}
                      boton="Quitar"
                      variante="ghost"
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {esAdmin && (
        <section aria-labelledby="anadir-briefing" className="flex flex-col gap-3">
          <h3 id="anadir-briefing" className="text-sm font-medium">
            Añadir un elemento
          </h3>
          <FormAccion
            accion={accionAnadirBriefing.bind(null, serviceId)}
            boton="Añadir al briefing"
            variante="secondary"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Qué se pide">
                <Input name="etiqueta" required maxLength={120} placeholder="Color principal" />
              </Field>
              <Field label="Tipo">
                <Select name="tipo" defaultValue="texto">
                  {Object.entries(TIPOS_ELEMENTO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sección" hint="Agrupa elementos: Marca, Contenido, Legal…">
                <Input name="seccion" maxLength={60} placeholder="General" />
              </Field>
            </div>
            <Field label="Ayuda para el cliente" hint="Opcional: ejemplos o qué formato esperas.">
              <Textarea name="ayuda" rows={2} maxLength={1000} />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="obligatorio"
                defaultChecked
                className="size-4 accent-[rgb(var(--rgb-primary))]"
              />
              Obligatorio (si no, el cliente puede marcarlo como «no aplica»)
            </label>
          </FormAccion>
        </section>
      )}
    </Card>
  );
}
