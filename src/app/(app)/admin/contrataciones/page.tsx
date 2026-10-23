import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/app-shell/Encabezado";
import { BloqueNoDisponible, ModuloSeguro } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { euros, fecha } from "@/lib/formato";
import {
  CIERRES_MANUALES,
  ESTADOS,
  ETAPAS,
  etapaEmbudo,
  TRANSICIONES,
} from "@/modulos/contrataciones";
import { type Contratacion, listarContrataciones } from "@/modulos/contrataciones/servidor";
import { accionCerrar } from "./actions";

export const metadata: Metadata = { title: "Contrataciones" };

/**
 * Embudo de onboarding: en qué paso está cada contratación, de la invitación a
 * «pagado y en marcha». Los pasos del cliente (datos, firma, pago) llegan en
 * las fases 3 y 4; hoy el embudo enseña invitado y cuenta creada.
 */
export default function ContratacionesPage() {
  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        titulo="Contrataciones"
        descripcion="Dónde está cada cliente en su alta: invitación, cuenta, datos, contrato y pago."
      />
      <ModuloSeguro nombre="El embudo de contrataciones">
        <Embudo />
      </ModuloSeguro>
    </div>
  );
}

async function Embudo() {
  const r = await listarContrataciones();
  if (!r.ok) return <BloqueNoDisponible nombre="El embudo de contrataciones" />;

  const porEtapa = new Map<string, Contratacion[]>(ETAPAS.map((e) => [e.id, []]));
  const cerradas: Contratacion[] = [];
  for (const c of r.datos) {
    const etapa = etapaEmbudo(c.status, c.invitacion_aceptada);
    if (etapa) porEtapa.get(etapa)?.push(c);
    else cerradas.push(c);
  }

  return (
    <div className="flex flex-col gap-8">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Embudo">
        {ETAPAS.map((e) => (
          <li key={e.id} className="surface-card flex flex-col gap-1 rounded-2xl p-4">
            <span className="text-2xl font-semibold" data-testid={`etapa-${e.id}`}>
              {porEtapa.get(e.id)?.length ?? 0}
            </span>
            <span className="text-xs text-muted">{e.etiqueta}</span>
          </li>
        ))}
      </ol>

      {ETAPAS.map((e) => {
        const lista = porEtapa.get(e.id) ?? [];
        if (lista.length === 0) return null;
        return (
          <section key={e.id} aria-labelledby={`seccion-${e.id}`} className="flex flex-col gap-3">
            <h2 id={`seccion-${e.id}`} className="text-lg font-semibold">
              {e.etiqueta}
            </h2>
            <ul className="flex flex-col gap-3">
              {lista.map((c) => (
                <li key={c.id}>
                  <FilaContratacion c={c} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cerradas.length > 0 && (
        <details className="surface-card rounded-2xl p-5">
          <summary className="cursor-pointer text-sm font-medium">
            Cerradas y borradores ({cerradas.length})
          </summary>
          <ul className="mt-4 flex flex-col gap-3">
            {cerradas.map((c) => (
              <li key={c.id}>
                <FilaContratacion c={c} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {r.datos.length === 0 && (
        <p className="text-sm text-muted">
          Aún no hay contrataciones. Se crean al invitar a un cliente con un servicio, desde su
          ficha.
        </p>
      )}
    </div>
  );
}

function FilaContratacion({ c }: { c: Contratacion }) {
  const cierres = CIERRES_MANUALES.filter((e) => TRANSICIONES[c.status].includes(e));
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5" data-testid="fila-contratacion">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-col">
          <Link
            href={`/admin/clientes/${c.organization_id}`}
            className="font-medium hover:underline"
          >
            {c.cliente}
          </Link>
          <span className="text-sm text-muted">
            {c.servicio} · {euros(c.price_cents)} + IVA
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone={ESTADOS[c.status].tono}>{ESTADOS[c.status].etiqueta}</Badge>
          {c.status === "invitada" && (
            <Badge tone={c.invitacion_aceptada ? "success" : "neutral"}>
              {c.invitacion_aceptada ? "Cuenta creada" : "Sin cuenta aún"}
            </Badge>
          )}
          <span>desde el {fecha(c.status_changed_at)}</span>
        </span>
      </div>
      {cierres.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            Cerrar contratación
          </summary>
          <FormAccion
            accion={accionCerrar.bind(null, c.id)}
            boton="Cerrar"
            variante="secondary"
            className="mt-3 sm:flex-row sm:items-end"
          >
            <div className="sm:w-44">
              <Field label="Cómo">
                <Select name="estado" defaultValue={cierres[0]}>
                  {cierres.map((e) => (
                    <option key={e} value={e}>
                      {ESTADOS[e].etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Motivo">
                <Input name="motivo" required maxLength={500} />
              </Field>
            </div>
          </FormAccion>
        </details>
      )}
    </Card>
  );
}
