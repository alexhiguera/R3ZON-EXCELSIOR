import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Textarea } from "@/components/ui/Input";
import { nivelActual } from "@/lib/auth/nivel";
import { datosPrestador, listarCatalogo } from "@/modulos/contratos/servidor";
import { AyudaHuecos } from "./AyudaHuecos";
import { accionCrear, accionGuardarPrestador } from "./actions";

export const metadata: Metadata = { title: "Contratos" };

/**
 * Herramienta de contratos del equipo: plantillas con huecos, cláusulas
 * prediseñadas que se activan en cada contrato, y los datos de R3ZON como
 * prestador. Los anexos a mano se escriben en cada contratación. Gestiona el
 * admin; el resto del equipo lo ve.
 */
export default async function ContratosPage() {
  const esAdmin = (await nivelActual()) === "admin";
  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Contratos"
        descripcion="Plantillas y cláusulas para preparar el contrato de cada contratación. Cambiar un texto crea una versión nueva: lo ya enviado o firmado no cambia."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Plantillas</h2>
          <ModuloSeguro nombre="Las plantillas">
            <Lista tipo="plantilla" />
          </ModuloSeguro>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Cláusulas</h2>
          <ModuloSeguro nombre="Las cláusulas">
            <Lista tipo="clausula" />
          </ModuloSeguro>
        </Card>
      </div>

      {esAdmin && (
        <>
          <section aria-labelledby="nueva-plantilla">
            <Card className="flex flex-col gap-4">
              <h2 id="nueva-plantilla" className="text-lg font-semibold">
                Nueva plantilla
              </h2>
              <AyudaHuecos />
              <FormAccion accion={accionCrear.bind(null, "plantilla")} boton="Crear plantilla">
                <Field label="Nombre">
                  <Input name="nombre" required maxLength={120} />
                </Field>
                <Field label="Descripción" hint="Para el equipo: cuándo usarla.">
                  <Input name="descripcion" maxLength={500} />
                </Field>
                <Field label="Texto">
                  <Textarea name="texto" rows={14} required className="font-mono text-xs" />
                </Field>
              </FormAccion>
            </Card>
          </section>

          <section aria-labelledby="nueva-clausula">
            <Card className="flex flex-col gap-4">
              <h2 id="nueva-clausula" className="text-lg font-semibold">
                Nueva cláusula
              </h2>
              <FormAccion accion={accionCrear.bind(null, "clausula")} boton="Crear cláusula">
                <Field label="Título" hint="Sale como encabezado de la sección en el contrato.">
                  <Input name="nombre" required maxLength={200} />
                </Field>
                <Field label="Descripción" hint="Para el equipo: cuándo activarla.">
                  <Input name="descripcion" maxLength={500} />
                </Field>
                <Field label="Texto">
                  <Textarea name="texto" rows={8} required className="font-mono text-xs" />
                </Field>
              </FormAccion>
            </Card>
          </section>
        </>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Datos de R3ZON</h2>
        <p className="mb-4 text-sm text-muted">
          Rellenan los huecos <code>{"{{r3zon.*}}"}</code> de todos los contratos.
        </p>
        <ModuloSeguro nombre="Los datos de R3ZON">
          <Prestador esAdmin={esAdmin} />
        </ModuloSeguro>
      </Card>
    </div>
  );
}

async function Lista({ tipo }: { tipo: "plantilla" | "clausula" }) {
  const r = await listarCatalogo(tipo);
  if (!r.ok)
    return (
      <BloqueNoDisponible nombre={tipo === "plantilla" ? "Las plantillas" : "Las cláusulas"} />
    );
  if (r.datos.length === 0) return <p className="text-sm text-muted">Todavía no hay ninguna.</p>;
  const ruta = tipo === "plantilla" ? "plantillas" : "clausulas";
  return (
    <ul className="flex flex-col gap-2">
      {r.datos.map((e) => (
        <li key={e.id}>
          <Link
            href={`/admin/contratos/${ruta}/${e.id}`}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
            data-testid={tipo}
          >
            <span className="flex flex-col">
              <span className="font-medium">{e.nombre}</span>
              {e.descripcion && <span className="text-xs text-muted">{e.descripcion}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
              {e.version ? `v${e.version}` : "sin texto"}
              {e.archivado && <Badge>Archivada</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Prestador({ esAdmin }: { esAdmin: boolean }) {
  const r = await datosPrestador();
  if (!r.ok) return <BloqueNoDisponible nombre="Los datos de R3ZON" />;
  const d = r.datos;
  if (!esAdmin) {
    return (
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Razón social</dt>
          <dd>{d.legal_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">NIF</dt>
          <dd>{d.tax_id || "—"}</dd>
        </div>
      </dl>
    );
  }
  return (
    <FormAccion accion={accionGuardarPrestador} boton="Guardar datos de R3ZON" variante="secondary">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razón social de R3ZON">
          <Input name="legal_name" defaultValue={d.legal_name} maxLength={200} />
        </Field>
        <Field label="NIF de R3ZON">
          <Input name="tax_id" defaultValue={d.tax_id} maxLength={20} />
        </Field>
        <Field label="Dirección de R3ZON">
          <Input name="address" defaultValue={d.address} maxLength={300} />
        </Field>
        <Field label="Email de contacto">
          <Input name="email" type="email" defaultValue={d.email} maxLength={200} />
        </Field>
      </div>
    </FormAccion>
  );
}
