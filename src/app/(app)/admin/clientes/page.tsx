import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { fecha } from "@/lib/formato";
import { type FiltroClientes, listarClientes } from "@/modulos/organizaciones/servidor";
import { accionCrearCliente } from "./actions";

export const metadata: Metadata = { title: "Clientes" };

const ESTADOS = ["activos", "archivados", "todos"] as const;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const filtro: FiltroClientes = {
    busqueda: params.q?.slice(0, 100),
    estado: ESTADOS.find((e) => e === params.estado) ?? "activos",
  };

  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Clientes"
        descripcion="Empresas que trabajan con R3ZON. Desde la ficha de cada una se invita a sus personas y se les asigna un servicio."
      />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Nuevo cliente</h2>
        <FormAccion
          accion={accionCrearCliente}
          boton="Crear cliente"
          className="sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Field label="Nombre de la empresa">
              <Input name="nombre" required maxLength={200} autoComplete="organization" />
            </Field>
          </div>
        </FormAccion>
      </Card>

      <section aria-labelledby="listado" className="flex flex-col gap-4">
        <h2 id="listado" className="sr-only">
          Listado de clientes
        </h2>
        <search>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Buscar por nombre">
                <Input name="q" type="search" defaultValue={filtro.busqueda} />
              </Field>
            </div>
            <div className="sm:w-48">
              <Field label="Estado">
                <Select name="estado" defaultValue={filtro.estado}>
                  <option value="activos">Activos</option>
                  <option value="archivados">Archivados</option>
                  <option value="todos">Todos</option>
                </Select>
              </Field>
            </div>
            <button
              type="submit"
              className="rounded-full border border-border px-5 py-2.5 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
            >
              Filtrar
            </button>
          </form>
        </search>

        <ModuloSeguro nombre="El listado de clientes">
          <Listado filtro={filtro} />
        </ModuloSeguro>
      </section>
    </div>
  );
}

async function Listado({ filtro }: { filtro: FiltroClientes }) {
  const clientes = await listarClientes(filtro);
  if (!clientes.ok) return <BloqueNoDisponible nombre="El listado de clientes" />;
  if (clientes.datos.length === 0) {
    return <p className="text-sm text-muted">No hay clientes con ese filtro.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {clientes.datos.map((c) => (
        <li key={c.id}>
          <Link
            href={`/admin/clientes/${c.id}`}
            className="surface-card flex flex-col gap-1 rounded-2xl p-4 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-brand sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium" data-testid="cliente">
              {c.name}
            </span>
            <span className="flex items-center gap-3 text-xs text-muted">
              <span>
                {c.miembros} {c.miembros === 1 ? "persona" : "personas"}
              </span>
              <span>Alta: {fecha(c.created_at)}</span>
              {c.archived_at && <Badge>Archivado</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
