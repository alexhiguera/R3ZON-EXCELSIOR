import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { nivelActual } from "@/lib/auth/nivel";
import { euros, porcentaje } from "@/lib/formato";
import { listarCategorias, listarServicios } from "@/modulos/servicios/servidor";
import { accionCrearCategoria, accionCrearServicio } from "./actions";
import { CamposCondiciones } from "./CamposCondiciones";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const esAdmin = (await nivelActual()) === "admin";

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Servicios"
        descripcion="Plantillas de lo que vende R3ZON. Cada contratación copia nombre, precio e IVA y los ajusta: cambiar el catálogo no toca lo contratado."
      />

      <ModuloSeguro nombre="El catálogo">
        <Catalogo />
      </ModuloSeguro>

      {esAdmin ? (
        <ModuloSeguro nombre="El alta de servicios">
          <Altas />
        </ModuloSeguro>
      ) : (
        <p className="text-sm text-muted">Solo un administrador puede crear o cambiar servicios.</p>
      )}
    </div>
  );
}

/** Solo admin: nuevo servicio (con su tipo) y tipos de servicio nuevos. */
async function Altas() {
  const categorias = await listarCategorias();
  if (!categorias.ok) return <BloqueNoDisponible nombre="El alta de servicios" />;
  return (
    <>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Nuevo servicio</h2>
        <FormAccion accion={accionCrearServicio} boton="Crear servicio">
          <Field label="Nombre">
            <Input name="nombre" required maxLength={120} />
          </Field>
          <Field label="Tipo de servicio">
            <Select name="categoria" required defaultValue={categorias.datos[0]?.id}>
              {categorias.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resumen" hint="Una frase para el cliente.">
            <Input name="resumen" maxLength={500} />
          </Field>
          <CamposCondiciones />
        </FormAccion>
      </Card>
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Tipos de servicio</h2>
        <p className="mb-4 text-sm text-muted">{categorias.datos.map((c) => c.name).join(" · ")}</p>
        <FormAccion accion={accionCrearCategoria} boton="Añadir tipo" variante="secondary">
          <Field
            label="Nuevo tipo de servicio"
            hint="P. ej. «Ciberseguridad». No cambia cómo se cobra."
          >
            <Input name="nombre" required maxLength={60} />
          </Field>
        </FormAccion>
      </Card>
    </>
  );
}

async function Catalogo() {
  const [servicios, categorias] = await Promise.all([
    listarServicios({ incluirArchivados: true }),
    listarCategorias({ incluirArchivadas: true }),
  ]);
  if (!servicios.ok) return <BloqueNoDisponible nombre="El catálogo" />;
  const categoria = new Map(categorias.ok ? categorias.datos.map((c) => [c.id, c.name]) : []);
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
                    + {porcentaje(s.vat_rate ?? 0)} IVA · v{s.version}
                  </span>
                </>
              ) : (
                <Badge tone="warning">Sin condiciones</Badge>
              )}
            </span>
            {s.category_id && categoria.get(s.category_id) && (
              <span className="flex flex-wrap gap-1">
                <Badge tone="brand">{categoria.get(s.category_id)}</Badge>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
