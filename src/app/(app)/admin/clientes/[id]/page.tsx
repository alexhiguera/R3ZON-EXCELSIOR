import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FormAccion } from "@/components/ui/FormAccion";
import { euros, fecha, fechaHora } from "@/lib/formato";
import { invitacionesAbiertas } from "@/modulos/acceso/servidor";
import { ESTADOS } from "@/modulos/contrataciones";
import { listarContrataciones } from "@/modulos/contrataciones/servidor";
import { ETIQUETA_ROL } from "@/modulos/organizaciones";
import { actividad, cliente, datosFiscales, directorio } from "@/modulos/organizaciones/servidor";
import { accionArchivar, accionInvitar, accionRevocar } from "../actions";
import { CamposInvitacion } from "../CamposInvitacion";

export const metadata: Metadata = { title: "Ficha de cliente" };

/**
 * Ficha de un cliente. Cada bloque es de un módulo distinto y va en su propio
 * `ModuloSeguro`: si falla, p. ej., el de contrataciones, la ficha y la
 * invitación siguen funcionando.
 */
export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const r = await cliente(id);
  if (!r.ok) return <BloqueNoDisponible nombre="La ficha del cliente" />;
  if (!r.datos) notFound();
  const c = r.datos;
  const archivado = Boolean(c.archived_at);

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        volver={{ href: "/admin/clientes", label: "Clientes" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {c.name}
            {archivado && <Badge>Archivado</Badge>}
          </span>
        }
        descripcion={`Cliente desde el ${fecha(c.created_at)}.`}
        acciones={
          <>
            <Link
              href={`/admin/clientes/${c.id}/vista`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Eye aria-hidden="true" className="size-4" />
              Ver como cliente
            </Link>
            <FormAccion
              accion={accionArchivar.bind(null, c.id, !archivado)}
              boton={archivado ? "Reactivar" : "Archivar"}
              variante="secondary"
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Invitar a una persona</h2>
          <p className="mb-4 text-sm text-muted">
            Con un servicio, se crea la contratación y la persona entra como propietaria para
            completar el alta. Sin servicio, solo se le da acceso con el rol elegido.
          </p>
          <ModuloSeguro nombre="El formulario de invitación">
            <FormularioInvitacion organizationId={c.id} />
          </ModuloSeguro>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Personas</h2>
          <ModuloSeguro nombre="Las personas del cliente">
            <Personas organizationId={c.id} />
          </ModuloSeguro>
          <h3 className="mt-6 mb-3 text-sm font-medium text-muted">Invitaciones abiertas</h3>
          <ModuloSeguro nombre="Las invitaciones">
            <Invitaciones organizationId={c.id} />
          </ModuloSeguro>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Contrataciones</h2>
        <ModuloSeguro nombre="Las contrataciones">
          <Contrataciones organizationId={c.id} />
        </ModuloSeguro>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Datos fiscales</h2>
        <ModuloSeguro nombre="Los datos fiscales">
          <ResumenFiscal organizationId={c.id} />
        </ModuloSeguro>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Actividad</h2>
        <ModuloSeguro nombre="La actividad">
          <Actividad organizationId={c.id} />
        </ModuloSeguro>
      </Card>
    </div>
  );
}

function FormularioInvitacion({ organizationId }: { organizationId: string }) {
  return (
    <FormAccion
      accion={accionInvitar.bind(null, organizationId)}
      boton="Crear invitación"
      etiquetaEnlace="Enlace de invitación (cópialo ahora: no se vuelve a mostrar)"
    >
      <CamposInvitacion />
    </FormAccion>
  );
}

async function Personas({ organizationId }: { organizationId: string }) {
  const personas = await directorio(organizationId);
  if (!personas.ok) return <BloqueNoDisponible nombre="Las personas del cliente" />;
  if (personas.datos.length === 0) {
    return <p className="text-sm text-muted">Nadie ha aceptado todavía una invitación.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {personas.datos.map((p) => (
        <li key={p.user_id} className="flex flex-col gap-0.5" data-testid="persona">
          <span className="font-medium">{p.display_name ?? p.email}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {p.email}
            <Badge tone="brand">{ETIQUETA_ROL[p.role]}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Invitaciones({ organizationId }: { organizationId: string }) {
  const invitaciones = await invitacionesAbiertas(organizationId);
  if (!invitaciones.ok) return <BloqueNoDisponible nombre="Las invitaciones" />;
  if (invitaciones.datos.length === 0) {
    return <p className="text-sm text-muted">No hay invitaciones pendientes.</p>;
  }
  const ahora = Date.now();
  return (
    <ul className="flex flex-col gap-3">
      {invitaciones.datos.map((i) => {
        const caducada = new Date(i.expires_at).getTime() <= ahora;
        return (
          <li
            key={i.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm" data-testid="invitacion">
                {i.email}
              </span>
              <span className="text-xs text-muted">
                {ETIQUETA_ROL[i.role]} ·{" "}
                {caducada ? "caducada" : `caduca el ${fechaHora(i.expires_at)}`}
              </span>
            </span>
            <FormAccion
              accion={accionRevocar.bind(null, organizationId, i.id)}
              boton="Anular"
              variante="ghost"
            />
          </li>
        );
      })}
    </ul>
  );
}

async function Contrataciones({ organizationId }: { organizationId: string }) {
  const contrataciones = await listarContrataciones({ organizationId });
  if (!contrataciones.ok) return <BloqueNoDisponible nombre="Las contrataciones" />;
  if (contrataciones.datos.length === 0) {
    return <p className="text-sm text-muted">Este cliente no tiene contrataciones.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {contrataciones.datos.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          data-testid="contratacion"
        >
          <Link href={`/admin/contrataciones/${e.id}`} className="font-medium hover:underline">
            {e.servicio} <span className="text-xs text-muted">v{e.version}</span>
          </Link>
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {euros(e.price_cents)} + IVA
            <Badge tone={ESTADOS[e.status].tono}>{ESTADOS[e.status].etiqueta}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

const ACCIONES: Record<string, string> = {
  "organization.created": "Cliente creado",
  "organization.archived": "Cliente archivado",
  "organization.unarchived": "Cliente reactivado",
  "member.added": "Persona añadida",
  "member.removed": "Persona quitada",
  "member.role_changed": "Rol cambiado",
  "invitation.created": "Invitación creada",
  "invitation.accepted": "Invitación aceptada",
  "invitation.revoked": "Invitación anulada",
  "organization.viewed_as_client": "El equipo abrió la vista de cliente",
  "billing.updated": "Datos fiscales actualizados",
  "contract.created": "Contrato creado",
  "contract.enviado": "Contrato enviado para firmar",
  "contract.borrador": "Contrato retirado para editar",
  "contract.firmado": "Contrato firmado",
  "contract.anulado": "Contrato anulado",
  "contract.delegated": "Firma delegada en otra persona",
  "engagement.created": "Contratación creada",
  "engagement.status_changed": "Contratación: cambio de estado",
};

async function Actividad({ organizationId }: { organizationId: string }) {
  const registro = await actividad(organizationId);
  if (!registro.ok) return <BloqueNoDisponible nombre="La actividad" />;
  if (registro.datos.length === 0) return <p className="text-sm text-muted">Sin actividad.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {registro.datos.map((a) => (
        <li key={a.id} className="flex justify-between gap-4 text-sm">
          <span>{ACCIONES[a.action] ?? a.action}</span>
          <time dateTime={a.created_at} className="shrink-0 text-xs text-muted">
            {fechaHora(a.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

async function ResumenFiscal({ organizationId }: { organizationId: string }) {
  const r = await datosFiscales(organizationId);
  if (!r.ok) return <BloqueNoDisponible nombre="Los datos fiscales" />;
  if (!r.datos) {
    return (
      <p className="text-sm text-muted">El cliente los dará en su alta, antes del contrato.</p>
    );
  }
  const d = r.datos;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2" data-testid="datos-fiscales">
      <div>
        <dt className="text-xs text-muted">Razón social</dt>
        <dd>{d.legal_name}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">NIF</dt>
        <dd>{d.tax_id}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted">Dirección</dt>
        <dd>
          {d.address}, {d.postal_code} {d.city}
          {d.province ? ` (${d.province})` : ""}, {d.country}
        </dd>
      </div>
      {d.billing_email && (
        <div>
          <dt className="text-xs text-muted">Email de facturación</dt>
          <dd>{d.billing_email}</dd>
        </div>
      )}
    </dl>
  );
}
