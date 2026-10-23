import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FormAccion } from "@/components/ui/FormAccion";
import { nivelActual } from "@/lib/auth/nivel";
import { euros, fecha, porcentaje } from "@/lib/formato";
import { servicio } from "@/modulos/servicios/servidor";
import { accionArchivarServicio, accionNuevaVersion } from "../actions";
import { CamposCondiciones } from "../CamposCondiciones";
import { PlantillaBriefing } from "./PlantillaBriefing";

export const metadata: Metadata = { title: "Servicio" };

export default async function ServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [r, nivel] = await Promise.all([servicio(id), nivelActual()]);
  if (!r.ok) return <BloqueNoDisponible nombre="El servicio" />;
  if (!r.datos) notFound();
  const { servicio: s, versiones } = r.datos;
  const esAdmin = nivel === "admin";
  const archivado = Boolean(s.archived_at);

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        volver={{ href: "/admin/servicios", label: "Servicios" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {s.name}
            {archivado && <Badge>Archivado</Badge>}
          </span>
        }
        descripcion={s.summary ?? undefined}
        acciones={
          esAdmin ? (
            <FormAccion
              accion={accionArchivarServicio.bind(null, s.id, !archivado)}
              boton={archivado ? "Reactivar" : "Archivar"}
              variante="secondary"
            />
          ) : undefined
        }
      />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Versiones</h2>
        {versiones.length === 0 ? (
          <p className="text-sm text-muted">Este servicio aún no tiene condiciones.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {versiones.map((v, i) => (
              <li key={v.id} className="flex flex-col gap-2" data-testid="version">
                <span className="flex flex-wrap items-center gap-2">
                  <strong>v{v.version}</strong>
                  {i === 0 && <Badge tone="success">Vigente</Badge>}
                  <span className="text-sm">
                    {euros(v.price_cents)} + {porcentaje(v.vat_rate)} IVA
                  </span>
                  <span className="text-xs text-muted">desde el {fecha(v.created_at)}</span>
                </span>
                {v.includes.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-muted">
                    {v.includes.map((linea) => (
                      <li key={linea}>{linea}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <ModuloSeguro nombre="La plantilla de briefing">
        <PlantillaBriefing serviceId={s.id} esAdmin={esAdmin} />
      </ModuloSeguro>

      {esAdmin && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Nuevas condiciones</h2>
          <p className="mb-4 text-sm text-muted">
            Se guardan como una versión nueva. Las contrataciones existentes conservan la suya.
          </p>
          <FormAccion accion={accionNuevaVersion.bind(null, s.id)} boton="Guardar versión nueva">
            <CamposCondiciones inicial={versiones[0] ?? undefined} />
          </FormAccion>
        </Card>
      )}
    </div>
  );
}
