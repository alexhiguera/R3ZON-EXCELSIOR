import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Card } from "@/components/ui/Card";
import { FormAccion } from "@/components/ui/FormAccion";
import { euros } from "@/lib/formato";
import { contratacion, ResumenCondiciones } from "@/modulos/contrataciones/servidor";
import { contratoDe } from "@/modulos/contratos/servidor";
import { rolEnEmpresa } from "@/modulos/organizaciones/servidor";
import { accionAceptarCambio } from "./actions";

export const metadata: Metadata = { title: "Cambio de condiciones" };

/**
 * Cambio de condiciones propuesto por R3ZON. El cliente lo revisa y lo acepta
 * (propietario o facturación). Si ya firmó un contrato, el cambio se acepta
 * firmando el contrato nuevo. Lo aceptado antes no se recalcula nunca.
 */
export default async function CambioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hecho?: string }>;
}) {
  const { id } = await params;
  const { hecho } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await contratacion(id);
  if (!r.ok) return <BloqueNoDisponible nombre="El cambio de condiciones" />;
  if (!r.datos) notFound();
  const e = r.datos;
  const cambio = e.cambio?.status === "propuesta" ? e.cambio : null;

  const volver = { href: "/inicio", label: "Inicio" };
  if (!cambio) {
    // Recién aceptado: se confirma con las condiciones que han quedado vigentes.
    const aceptado = hecho === "1" && e.vigente.number > 1;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Encabezado volver={volver} titulo="Cambio de condiciones" />
        <Card className="flex flex-col gap-4">
          {aceptado ? (
            <>
              <p role="status" className="text-sm">
                Cambio aceptado: estas son ya tus condiciones vigentes.
              </p>
              <ResumenCondiciones r={e.vigente} />
            </>
          ) : (
            <p className="text-sm text-muted">No hay ningún cambio pendiente de aceptar.</p>
          )}
        </Card>
      </div>
    );
  }

  const [rol, c] = await Promise.all([rolEnEmpresa(e.organization_id), contratoDe(e.id)]);
  const puedeAceptar = rol.ok && (rol.datos === "owner" || rol.datos === "billing");
  const contrato = c.ok ? c.datos : null;
  // Con contrato firmado, el cambio se acepta firmando el nuevo.
  const conFirma = e.requires_signature && (e.status === "firmada" || e.status === "activa");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Encabezado
        volver={volver}
        titulo="R3ZON te propone un cambio"
        descripcion={`${e.titulo} · antes ${euros(e.vigente.total_cents)}, ahora ${euros(cambio.total_cents)} (IVA incluido)`}
      />
      <Card className="flex flex-col gap-4" data-testid="cambio-propuesto">
        {cambio.reason && (
          <p className="text-sm">
            <strong>Motivo:</strong> {cambio.reason}
          </p>
        )}
        <ResumenCondiciones r={cambio} />
      </Card>

      <Card className="flex flex-col gap-3">
        {conFirma ? (
          contrato?.status === "enviado" ? (
            <>
              <p className="text-sm">
                Como ya firmaste un contrato, el cambio se acepta firmando el contrato nuevo.
              </p>
              <Link
                href={`/bienvenida/${e.id}?paso=contrato`}
                className="inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Revisar y firmar el contrato nuevo
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">
              Como ya firmaste un contrato, el cambio se acepta firmando uno nuevo. El equipo de
              R3ZON lo está preparando: lo verás aquí.
            </p>
          )
        ) : puedeAceptar ? (
          <FormAccion
            accion={accionAceptarCambio.bind(null, e.id, cambio.id)}
            boton="Aceptar el cambio"
          >
            <p className="text-sm text-muted">
              Al aceptarlo, estas condiciones sustituyen a las anteriores. Lo que ya hayas pagado se
              descuenta.
            </p>
          </FormAccion>
        ) : (
          <p className="text-sm text-muted">
            Lo acepta el propietario de la empresa o la persona de facturación.
          </p>
        )}
      </Card>
    </div>
  );
}
