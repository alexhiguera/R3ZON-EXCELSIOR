import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { euros, fechaHora } from "@/lib/formato";
import { ESTADOS } from "@/modulos/contrataciones";
import { contratacion, historial } from "@/modulos/contrataciones/servidor";
import { ESTADOS_CONTRATO, TextoContrato } from "@/modulos/contratos";
import {
  type Contrato,
  contratoDe,
  contratoFirmado,
  listarCatalogo,
  textoContrato,
} from "@/modulos/contratos/servidor";
import {
  accionAnadirAnexo,
  accionCrearContrato,
  accionEstadoContrato,
  accionGuardarClausulas,
  accionQuitarAnexo,
} from "./actions";
import { SeccionAlta } from "./SeccionAlta";
import { SeccionCobro } from "./SeccionCobro";
import { SeccionCondiciones } from "./SeccionCondiciones";

export const metadata: Metadata = { title: "Contratación" };

/**
 * Una contratación vista por el equipo: datos, historial y la preparación de
 * su contrato (plantilla, cláusulas, anexos, vista previa y envío).
 */
export default async function ContratacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await contratacion(id);
  if (!r.ok) return <BloqueNoDisponible nombre="La contratación" />;
  if (!r.datos) notFound();
  const e = r.datos;

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        volver={{ href: "/admin/contrataciones", label: "Contrataciones" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {e.titulo}
            <Badge tone={ESTADOS[e.status].tono}>{ESTADOS[e.status].etiqueta}</Badge>
          </span>
        }
        descripcion={
          <>
            <Link href={`/admin/clientes/${e.organization_id}`} className="hover:underline">
              {e.organizacion}
            </Link>{" "}
            · {euros(e.vigente.total_cents)} IVA incluido
          </>
        }
      />

      <ModuloSeguro nombre="Las condiciones económicas">
        <SeccionCondiciones e={e} />
      </ModuloSeguro>

      <ModuloSeguro nombre="El alta">
        <SeccionAlta e={e} />
      </ModuloSeguro>

      <ModuloSeguro nombre="El cobro">
        <SeccionCobro e={e} />
      </ModuloSeguro>

      {e.requires_signature ? (
        <ModuloSeguro nombre="El contrato">
          <SeccionContrato
            engagementId={e.id}
            estadoContratacion={e.status}
            hayCambio={Boolean(e.cambio)}
          />
        </ModuloSeguro>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold">Contrato</h2>
          <p className="mt-1 text-sm text-muted">
            Esta contratación no se firma en el portal (firmada fuera, o no lo necesita).
          </p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Historial</h2>
        <ModuloSeguro nombre="El historial">
          <Historial engagementId={e.id} />
        </ModuloSeguro>
      </Card>
    </div>
  );
}

async function SeccionContrato({
  engagementId,
  estadoContratacion,
  hayCambio,
}: {
  engagementId: string;
  estadoContratacion: string;
  /** Hay un cambio de condiciones en curso: el contrato firmado se puede sustituir. */
  hayCambio: boolean;
}) {
  const r = await contratoDe(engagementId);
  if (!r.ok) return <BloqueNoDisponible nombre="El contrato" />;
  const contrato = r.datos;
  // Con el contrato firmado y un cambio de condiciones en curso, se prepara uno
  // nuevo que lo sustituye al firmarse (lo firmado no se toca).
  const sustituible = contrato?.status === "firmado" && hayCambio;

  if (!contrato || contrato.status === "anulado" || sustituible) {
    const admite =
      sustituible || ["borrador", "invitada", "datos_completos"].includes(estadoContratacion);
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contrato</h2>
        {contrato?.status === "anulado" && (
          <p className="text-sm text-muted">El contrato anterior está anulado.</p>
        )}
        {sustituible && (
          <p className="text-sm text-muted">
            El contrato firmado sigue en vigor. Prepara uno nuevo con las condiciones propuestas:
            cuando el cliente lo firme, sustituirá al anterior y aceptará el cambio.
          </p>
        )}
        {admite ? (
          <NuevoContrato engagementId={engagementId} />
        ) : (
          <p className="text-sm text-muted">Esta contratación ya no admite un contrato nuevo.</p>
        )}
      </Card>
    );
  }

  // Firmado: el texto que SE FIRMÓ (guardado), nunca uno recompuesto ahora,
  // que cambiaría con los datos fiscales o el servicio.
  const texto =
    contrato.status === "firmado" || contrato.status === "sustituido"
      ? await contratoFirmado(contrato.id).then((r) =>
          r.ok && r.datos
            ? { ok: true as const, datos: r.datos.signed_text }
            : { ok: false as const },
        )
      : await textoContrato(contrato.id);
  const estado = ESTADOS_CONTRATO[contrato.status];
  const accion = (destino: "enviado" | "borrador" | "anulado") =>
    accionEstadoContrato.bind(null, engagementId, contrato.id, destino);

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">
          Contrato <Badge tone={estado.tono}>{estado.etiqueta}</Badge>
        </h2>
        <p className="text-sm text-muted">
          Plantilla «{contrato.plantilla}» v{contrato.plantilla_version}
          {contrato.sent_at && ` · enviado el ${fechaHora(contrato.sent_at)}`}
          {contrato.delegated_email && ` · firma delegada en ${contrato.delegated_email}`}
        </p>
        {contrato.status === "firmado" && (
          <div className="flex flex-col gap-2 text-sm">
            <p>Firmado el {fechaHora(contrato.signed_at)}.</p>
            <p className="break-all text-xs text-muted">SHA-256: {contrato.text_sha256}</p>
            <a
              href={`/contratos/${contrato.id}/pdf`}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2.5 hover:bg-white/5"
            >
              <FileDown aria-hidden="true" className="size-4" />
              Descargar PDF
            </a>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {contrato.status === "borrador" && (
            <FormAccion accion={accion("enviado")} boton="Enviar al cliente" />
          )}
          {contrato.status === "enviado" && (
            <FormAccion
              accion={accion("borrador")}
              boton="Retirar para editar"
              variante="secondary"
            />
          )}
          {(contrato.status === "borrador" || contrato.status === "enviado") && (
            <FormAccion accion={accion("anulado")} boton="Anular" variante="ghost" />
          )}
        </div>
      </Card>

      {contrato.status === "borrador" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-base font-semibold">Cláusulas</h3>
            <ModuloSeguro nombre="Las cláusulas">
              <Clausulas engagementId={engagementId} contrato={contrato} />
            </ModuloSeguro>
          </Card>
          <Card className="flex flex-col gap-4">
            <h3 className="text-base font-semibold">Anexos</h3>
            <Anexos engagementId={engagementId} contrato={contrato} />
          </Card>
        </div>
      )}

      <Card>
        <h3 className="mb-4 text-base font-semibold">
          {contrato.status === "firmado"
            ? "Texto firmado"
            : "Vista previa (lo que verá y firmará el cliente)"}
        </h3>
        {texto.ok ? (
          <TextoContrato texto={texto.datos} />
        ) : (
          <BloqueNoDisponible nombre="La vista previa" />
        )}
      </Card>
    </div>
  );
}

async function NuevoContrato({ engagementId }: { engagementId: string }) {
  const plantillas = await listarCatalogo("plantilla");
  if (!plantillas.ok) return <BloqueNoDisponible nombre="Las plantillas" />;
  const usables = plantillas.datos.filter((p) => p.versionId && !p.archivado);
  if (usables.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay plantillas. Crea una en{" "}
        <Link href="/admin/contratos" className="underline">
          Contratos
        </Link>
        .
      </p>
    );
  }
  return (
    <FormAccion accion={accionCrearContrato.bind(null, engagementId)} boton="Crear contrato">
      <Field label="Plantilla">
        <Select name="plantilla" defaultValue={usables[0]?.versionId ?? ""}>
          {usables.map((p) => (
            <option key={p.id} value={p.versionId ?? ""}>
              {p.nombre} (v{p.version})
            </option>
          ))}
        </Select>
      </Field>
    </FormAccion>
  );
}

async function Clausulas({ engagementId, contrato }: { engagementId: string; contrato: Contrato }) {
  const r = await listarCatalogo("clausula");
  if (!r.ok) return <BloqueNoDisponible nombre="Las cláusulas" />;
  const disponibles = r.datos.filter((c) => c.versionId && !c.archivado);
  if (disponibles.length === 0) return <p className="text-sm text-muted">No hay cláusulas.</p>;
  return (
    <FormAccion
      accion={accionGuardarClausulas.bind(null, engagementId, contrato.id)}
      boton="Guardar cláusulas"
      variante="secondary"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Cláusulas del contrato</legend>
        {disponibles.map((c) => (
          <label key={c.id} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="clausulas"
              value={c.versionId ?? ""}
              defaultChecked={contrato.clausulas.includes(c.versionId ?? "")}
              className="mt-0.5 size-4 accent-[rgb(var(--rgb-primary))]"
            />
            <span className="flex flex-col">
              <span className="font-medium">{c.nombre}</span>
              {c.descripcion && <span className="text-xs text-muted">{c.descripcion}</span>}
            </span>
          </label>
        ))}
      </fieldset>
    </FormAccion>
  );
}

function Anexos({ engagementId, contrato }: { engagementId: string; contrato: Contrato }) {
  return (
    <>
      {contrato.anexos.length > 0 && (
        <ol className="flex flex-col gap-3">
          {contrato.anexos.map((a, i) => (
            <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
              <span>
                <strong>Anexo {i + 1}.</strong> {a.title}
              </span>
              <FormAccion
                accion={accionQuitarAnexo.bind(null, engagementId, a.id)}
                boton="Quitar"
                variante="ghost"
              />
            </li>
          ))}
        </ol>
      )}
      <FormAccion
        accion={accionAnadirAnexo.bind(null, engagementId, contrato.id, contrato.anexos.length)}
        boton="Añadir anexo"
        variante="secondary"
      >
        <Field label="Título del anexo">
          <Input name="titulo" required maxLength={200} />
        </Field>
        <Field
          label="Texto del anexo"
          hint="Admite los mismos huecos y formato que las plantillas."
        >
          <Textarea name="texto" rows={5} required />
        </Field>
      </FormAccion>
    </>
  );
}

async function Historial({ engagementId }: { engagementId: string }) {
  const r = await historial(engagementId);
  if (!r.ok) return <BloqueNoDisponible nombre="El historial" />;
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {r.datos.map((h) => (
        <li key={h.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <span>
            {h.from_status ? `${ESTADOS[h.from_status].etiqueta} → ` : ""}
            {ESTADOS[h.to_status].etiqueta}
            {h.reason ? <span className="text-muted"> · {h.reason}</span> : null}
          </span>
          <time dateTime={h.changed_at} className="text-xs text-muted">
            {fechaHora(h.changed_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
