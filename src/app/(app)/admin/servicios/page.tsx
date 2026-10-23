import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input } from "@/components/ui/Input";
import { nivelActual } from "@/lib/auth/nivel";
import { euros } from "@/lib/formato";
import { ETIQUETA_PLAN } from "@/modulos/servicios";
import { listarServicios } from "@/modulos/servicios/servidor";
import { accionCrearServicio } from "./actions";
import { CamposCondiciones } from "./CamposCondiciones";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const esAdmin = (await nivelActual()) === "admin";

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Servicios"
        descripcion="Catálogo de lo que vende R3ZON. Cambiar un precio crea una versión nueva: lo ya contratado conserva sus condiciones."
      />

      <ModuloSeguro nombre="El catálogo">
        <Catalogo />
      </ModuloSeguro>

      {esAdmin ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Nuevo servicio</h2>
          <FormAccion accion={accionCrearServicio} boton="Crear servicio">
            <Field label="Nombre">
              <Input name="nombre" required maxLength={120} />
            </Field>
            <Field label="Resumen" hint="Una frase para el cliente.">
              <Input name="resumen" maxLength={500} />
            </Field>
            <CamposCondiciones />
          </FormAccion>
        </Card>
      ) : (
        <p className="text-sm text-muted">Solo un administrador puede crear o cambiar servicios.</p>
      )}
    </div>
  );
}

async function Catalogo() {
  const servicios = await listarServicios({ incluirArchivados: true });
  if (!servicios.ok) return <BloqueNoDisponible nombre="El catálogo" />;
  if (servicios.datos.length === 0) {
    return <p className="text-sm text-muted">Aún no hay servicios en el catálogo.</p>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {servicios.datos.map((s) => (
        <li key={s.id}>
          <Link
            href={`/admin/servicios/${s.id}`}
            className="surface-card flex h-full flex-col gap-2 rounded-2xl p-5 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium" data-testid="servicio">
                {s.name}
              </span>
              {s.archived_at && <Badge>Archivado</Badge>}
            </span>
            {s.summary && <span className="text-sm text-muted">{s.summary}</span>}
            <span className="mt-auto flex flex-wrap items-center gap-2 text-sm">
              {s.price_cents != null ? (
                <>
                  <strong>{euros(s.price_cents)}</strong>
                  <span className="text-muted">
                    + {s.vat_rate} % IVA · v{s.version}
                  </span>
                </>
              ) : (
                <Badge tone="warning">Sin condiciones</Badge>
              )}
            </span>
            <span className="flex flex-wrap gap-1">
              {s.payment_plans?.map((p) => (
                <Badge key={p} tone="brand">
                  {ETIQUETA_PLAN[p]}
                  {p === "senal_entrega" && s.deposit_percent ? ` (${s.deposit_percent} %)` : ""}
                </Badge>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
