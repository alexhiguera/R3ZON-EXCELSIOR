import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { fecha } from "@/lib/formato";
import {
  ESTADOS_ELEMENTO,
  ESTADOS_PROYECTO,
  porcentaje,
  porSeccion,
  TIPOS_ELEMENTO,
  TRANSICIONES_PROYECTO,
} from "@/modulos/proyectos";
import { type Elemento, proyecto } from "@/modulos/proyectos/servidor";
import { accionEstadoProyecto, accionRevisar } from "./actions";

export const metadata: Metadata = { title: "Proyecto" };

/** Ficha de un proyecto para el equipo: estado y revisión del briefing. */
export default async function AdminProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await proyecto(id);
  if (!r.ok) return <BloqueNoDisponible nombre="El proyecto" />;
  if (!r.datos) notFound();
  const p = r.datos;
  const siguientes = TRANSICIONES_PROYECTO[p.status];

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        volver={{ href: "/admin/proyectos", label: "Proyectos" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {p.name}
            <Badge tone={ESTADOS_PROYECTO[p.status].tono}>
              {ESTADOS_PROYECTO[p.status].etiqueta}
            </Badge>
          </span>
        }
        descripcion={
          <>
            <Link href={`/admin/clientes/${p.organization_id}`} className="hover:underline">
              {p.cliente}
            </Link>{" "}
            ·{" "}
            <Link href={`/admin/contrataciones/${p.engagement_id}`} className="hover:underline">
              contratación
            </Link>{" "}
            · desde el {fecha(p.created_at)} · briefing {porcentaje(p.progreso)} %
          </>
        }
      />

      {siguientes.length > 0 && (
        <Card>
          <FormAccion
            accion={accionEstadoProyecto.bind(null, p.id)}
            boton="Cambiar estado"
            variante="secondary"
            className="sm:flex-row sm:items-end"
          >
            <div className="sm:w-60">
              <Field label="Pasar a">
                <Select name="estado" defaultValue={siguientes[0]}>
                  {siguientes.map((e) => (
                    <option key={e} value={e}>
                      {ESTADOS_PROYECTO[e].etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormAccion>
        </Card>
      )}

      {p.elementos.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Este proyecto no tiene briefing: su servicio no tenía plantilla al crearse.
          </p>
        </Card>
      ) : (
        porSeccion(p.elementos).map(([seccion, elementos]) => (
          <section key={seccion} aria-label={seccion} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{seccion}</h2>
            {elementos.map((e) => (
              <Revision key={e.id} proyectoId={p.id} e={e} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Revision({ proyectoId, e }: { proyectoId: string; e: Elemento }) {
  return (
    <Card
      className="flex flex-col gap-3 p-4 sm:p-5"
      data-testid="revision-briefing"
      role="region"
      aria-label={e.label}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-medium">
          {e.label}{" "}
          <span className="text-xs font-normal text-muted">
            {TIPOS_ELEMENTO[e.kind]}
            {e.required ? "" : " · opcional"}
          </span>
        </span>
        <Badge tone={ESTADOS_ELEMENTO[e.status].tono}>{ESTADOS_ELEMENTO[e.status].etiqueta}</Badge>
      </div>
      {e.value ? (
        <p className="flex items-center gap-3 text-sm break-words whitespace-pre-line">
          {e.kind === "color" && (
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded-md border border-border"
              style={{ backgroundColor: e.value }}
            />
          )}
          {e.value}
        </p>
      ) : (
        <p className="text-sm text-muted">Sin respuesta todavía.</p>
      )}
      {e.staff_note && <p className="text-xs text-muted">Nota: {e.staff_note}</p>}
      {(e.status === "aportado" || e.status === "validado") && (
        <div className="grid gap-3 sm:grid-cols-2">
          {e.status === "aportado" && (
            <FormAccion
              accion={accionRevisar.bind(null, proyectoId, e.id, "validado")}
              boton="Validar"
              variante="secondary"
            />
          )}
          <FormAccion
            accion={accionRevisar.bind(null, proyectoId, e.id, "cambios")}
            boton="Pedir cambios"
            variante="ghost"
          >
            <Field label="Qué hay que cambiar">
              <Input name="nota" required maxLength={1000} />
            </Field>
          </FormAccion>
        </div>
      )}
    </Card>
  );
}
