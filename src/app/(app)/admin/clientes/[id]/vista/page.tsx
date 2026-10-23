import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { ResumenContrataciones } from "@/modulos/contrataciones/servidor";
import { cliente, registrarVistaCliente } from "@/modulos/organizaciones/servidor";

export const metadata: Metadata = { title: "Vista de cliente" };

/**
 * «Ver como cliente» (T-22): solo lectura y SIN suplantar. El equipo ve lo del
 * cliente con sus propios permisos, a través de los MISMOS componentes que usa
 * el inicio del cliente, así que ve exactamente lo mismo. Sin enlaces de
 * acción. Cada apertura queda en el registro de actividad.
 */
export default async function VistaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const r = await cliente(id);
  if (!r.ok) return <BloqueNoDisponible nombre="La vista de cliente" />;
  if (!r.datos) notFound();
  await registrarVistaCliente(id);

  return (
    <div className="flex flex-col gap-8">
      <div
        role="note"
        className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
      >
        <Eye aria-hidden="true" className="size-5 shrink-0 text-warning" />
        <span>
          Estás viendo el área de <strong>{r.datos.name}</strong> como la ve el cliente. Solo
          lectura; esta visita queda registrada.
        </span>
      </div>
      <Encabezado
        volver={{ href: `/admin/clientes/${id}`, label: "Ficha del cliente" }}
        titulo={r.datos.name}
        descripcion="Sus servicios y el paso en el que está cada uno."
      />
      <ModuloSeguro nombre="Sus servicios">
        <ResumenContrataciones organizationId={id} soloLectura />
      </ModuloSeguro>
    </div>
  );
}
