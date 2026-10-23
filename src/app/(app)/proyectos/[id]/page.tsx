import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Textarea } from "@/components/ui/Input";
import { rolEnEmpresa } from "@/modulos/organizaciones/servidor";
import {
  ESTADOS_ELEMENTO,
  ESTADOS_PROYECTO,
  editablePorCliente,
  porcentaje,
  porSeccion,
} from "@/modulos/proyectos";
import { type Elemento, proyecto } from "@/modulos/proyectos/servidor";
import { accionAplazar, accionAportar } from "./actions";

export const metadata: Metadata = { title: "Briefing" };

/**
 * Briefing de un proyecto: lo que R3ZON necesita del cliente, elemento a
 * elemento. Se puede dejar a medias («más tarde») y lo opcional, marcar como
 * «no aplica». Nunca pide contraseñas (T-07); los ficheros llegan más
 * adelante (T-33).
 */
export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await proyecto(id);
  if (!r.ok) return <BloqueNoDisponible nombre="El briefing" />;
  if (!r.datos) notFound();
  const p = r.datos;
  const pct = porcentaje(p.progreso);
  // Escriben propietario y miembros; facturación solo lee (lo vuelve a decidir la RLS).
  const rol = await rolEnEmpresa(p.organization_id);
  const escribe = rol.ok && (rol.datos === "owner" || rol.datos === "member");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Encabezado
        volver={{ href: "/proyectos", label: "Proyectos" }}
        titulo={`Briefing · ${p.name}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={ESTADOS_PROYECTO[p.status].tono}>
              {ESTADOS_PROYECTO[p.status].etiqueta}
            </Badge>
            <span data-testid="progreso-briefing">{pct} % completado</span>
          </span>
        }
      />
      <p className="text-sm text-muted">
        Cuéntanos lo que necesitamos para tu proyecto. Puedes dejar cualquier cosa para más tarde y
        volver cuando quieras. Nunca te pediremos contraseñas aquí: los accesos los recogemos por
        otra vía.
      </p>
      {!escribe && (
        <p role="note" className="text-sm text-muted">
          Con tu acceso puedes ver el briefing, pero lo completan el propietario o los miembros de
          tu empresa.
        </p>
      )}

      {p.elementos.length === 0 && (
        <Card>
          <p className="text-sm text-muted">Por ahora no necesitamos nada más. ¡Gracias!</p>
        </Card>
      )}

      {porSeccion(p.elementos).map(([seccion, elementos]) => (
        <section key={seccion} aria-label={seccion} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{seccion}</h2>
          {elementos.map((e) => (
            <ElementoBriefing
              key={e.id}
              proyectoId={p.id}
              e={e}
              editable={escribe && editablePorCliente(e.status, p.status)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ElementoBriefing({
  proyectoId,
  e,
  editable,
}: {
  proyectoId: string;
  e: Elemento;
  editable: boolean;
}) {
  return (
    <Card
      className="flex flex-col gap-4"
      data-testid="elemento-briefing"
      aria-label={e.label}
      role="region"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="font-medium">
          {e.label}
          {!e.required && <span className="ml-2 text-xs font-normal text-muted">(opcional)</span>}
        </h3>
        <Badge tone={ESTADOS_ELEMENTO[e.status].tono}>{ESTADOS_ELEMENTO[e.status].etiqueta}</Badge>
      </div>
      {e.help && <p className="text-sm text-muted">{e.help}</p>}
      {e.status === "cambios" && e.staff_note && (
        <p role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          R3ZON te pide: {e.staff_note}
        </p>
      )}

      {editable ? (
        <>
          <FormAccion
            accion={accionAportar.bind(null, proyectoId, e.id)}
            boton={e.value ? "Guardar cambios" : "Enviar"}
          >
            <CampoValor e={e} />
          </FormAccion>
          {(e.status === "pendiente" || e.status === "cambios" || !e.required) && (
            <div className="flex flex-wrap gap-2">
              {(e.status === "pendiente" || e.status === "cambios") && (
                <FormAccion
                  accion={accionAplazar.bind(null, proyectoId, e.id, "mas_tarde")}
                  boton="Más tarde"
                  variante="ghost"
                />
              )}
              {!e.required && e.status !== "no_aplica" && (
                <FormAccion
                  accion={accionAplazar.bind(null, proyectoId, e.id, "no_aplica")}
                  boton="No aplica"
                  variante="ghost"
                />
              )}
            </div>
          )}
        </>
      ) : (
        e.value && <ValorLeido e={e} />
      )}
    </Card>
  );
}

function CampoValor({ e }: { e: Elemento }) {
  const valor = e.value ?? "";
  switch (e.kind) {
    case "texto":
      return (
        <Field label="Tu respuesta">
          <Textarea name="valor" rows={5} maxLength={10000} defaultValue={valor} required />
        </Field>
      );
    case "color":
      return (
        <Field
          label="Color en hexadecimal"
          hint="Por ejemplo #1A2B3C. Si no lo sabes, déjalo para más tarde."
        >
          <Input
            name="valor"
            defaultValue={valor}
            required
            pattern="#[0-9A-Fa-f]{6}"
            placeholder="#1A2B3C"
            autoComplete="off"
          />
        </Field>
      );
    case "tipografia":
      return (
        <Field label="Nombre de la tipografía" hint="La que usáis ahora o una que os guste.">
          <Input name="valor" defaultValue={valor} required maxLength={200} />
        </Field>
      );
    case "enlace":
      return (
        <Field label="Enlace" hint="Empieza por https://">
          <Input name="valor" type="url" defaultValue={valor} required maxLength={2000} />
        </Field>
      );
  }
}

function ValorLeido({ e }: { e: Elemento }) {
  return (
    <div className="flex items-center gap-3 text-sm" data-testid="valor-briefing">
      {e.kind === "color" && (
        <span
          aria-hidden="true"
          className="size-6 rounded-md border border-border"
          style={{ backgroundColor: e.value ?? undefined }}
        />
      )}
      <span className="break-words whitespace-pre-line">{e.value}</span>
    </div>
  );
}
