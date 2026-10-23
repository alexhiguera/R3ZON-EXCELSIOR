import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Textarea } from "@/components/ui/Input";
import { nivelActual } from "@/lib/auth/nivel";
import { fecha } from "@/lib/formato";
import { TextoContrato } from "@/modulos/contratos";
import { elementoCatalogo } from "@/modulos/contratos/servidor";
import { AyudaHuecos } from "../../AyudaHuecos";
import { accionNuevaVersion } from "../../actions";

export const metadata: Metadata = { title: "Texto de contrato" };

const TIPOS = { plantillas: "plantilla", clausulas: "clausula" } as const;

export default async function ElementoPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo: ruta, id } = await params;
  const tipo = TIPOS[ruta as keyof typeof TIPOS];
  if (!tipo || !z.uuid().safeParse(id).success) notFound();

  const [r, nivel] = await Promise.all([elementoCatalogo(tipo, id), nivelActual()]);
  if (!r.ok) return <BloqueNoDisponible nombre="El texto" />;
  if (!r.datos) notFound();
  const { elemento, versiones } = r.datos;
  const vigente = versiones[0];

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        volver={{ href: "/admin/contratos", label: "Contratos" }}
        titulo={elemento.nombre}
        descripcion={elemento.descripcion ?? (tipo === "plantilla" ? "Plantilla" : "Cláusula")}
      />

      {vigente && (
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            Versión vigente <Badge tone="success">v{vigente.version}</Badge>
          </h2>
          <TextoContrato texto={vigente.body} />
        </Card>
      )}

      {nivel === "admin" && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Nueva versión</h2>
          <AyudaHuecos />
          <FormAccion
            accion={accionNuevaVersion.bind(null, tipo, id)}
            boton="Guardar versión nueva"
          >
            <Field label="Texto">
              <Textarea
                name="texto"
                rows={16}
                required
                defaultValue={vigente?.body ?? ""}
                className="font-mono text-xs"
              />
            </Field>
          </FormAccion>
        </Card>
      )}

      {versiones.length > 1 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Historial</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {versiones.map((v) => (
              <li key={v.id} className="flex justify-between">
                <span>v{v.version}</span>
                <span className="text-muted">{fecha(v.created_at)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
