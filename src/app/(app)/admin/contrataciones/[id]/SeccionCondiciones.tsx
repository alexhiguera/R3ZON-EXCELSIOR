import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { centimosATexto, euros, fecha } from "@/lib/formato";
import { ESTADOS_REVISION } from "@/modulos/contrataciones";
import {
  type DetalleContratacion,
  type Linea,
  ResumenCondiciones,
  type Revision,
} from "@/modulos/contrataciones/servidor";
import { type Categoria, listarCategorias, listarServicios } from "@/modulos/servicios/servidor";
import {
  accionAnadirHito,
  accionAnadirLinea,
  accionAnadirLineaCatalogo,
  accionCondicionesTexto,
  accionCrearRevision,
  accionDividirPagos,
  accionEditarLinea,
  accionEstadoRevision,
  accionQuitarHito,
  accionQuitarLinea,
} from "./actions";

/**
 * Condiciones económicas de la contratación: qué servicios, a qué precio, con
 * qué descuento e IVA, y cómo se paga. Los importes los calcula la base (aquí
 * no se suma nada): lo que se ve es lo que verá el cliente.
 *
 * · Antes de que el cliente dé sus datos, el equipo edita directamente.
 * · Después son inmutables: un cambio es una revisión nueva que se prepara,
 *   se propone y acepta el cliente (firmando un contrato nuevo si ya firmó).
 */
export async function SeccionCondiciones({ e }: { e: DetalleContratacion }) {
  const [servicios, categorias] = await Promise.all([listarServicios(), listarCategorias()]);
  if (!categorias.ok) return <BloqueNoDisponible nombre="Las condiciones" />;
  const catalogo = servicios.ok ? servicios.datos.filter((s) => s.version_id) : [];
  const cerrada = ["finalizada", "cancelada", "rescindida"].includes(e.status);
  const v = e.vigente;

  return (
    <Card className="flex flex-col gap-6" data-testid="seccion-condiciones">
      <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">
        Condiciones económicas
        <Badge tone={ESTADOS_REVISION[v.status].tono}>
          Revisión {v.number} · {ESTADOS_REVISION[v.status].etiqueta}
        </Badge>
      </h2>

      {v.status === "borrador" ? (
        <>
          <p className="text-sm text-muted">
            El cliente las verá en su bienvenida y las aceptará al dar sus datos. Hasta entonces
            puedes cambiarlas.
          </p>
          <Editor
            engagementId={e.id}
            r={v}
            catalogo={catalogo}
            categorias={categorias.datos}
            bloqueado={cerrada}
          />
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Aceptadas por el cliente{v.accepted_at ? ` el ${fecha(v.accepted_at)}` : ""}. Ya no
            cambian: para modificarlas, propón un cambio.
          </p>
          <ResumenCondiciones r={v} />
          {!cerrada && <Cambio e={e} catalogo={catalogo} categorias={categorias.datos} />}
        </>
      )}

      {e.anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            Revisiones anteriores ({e.anteriores.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {e.anteriores.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
                data-testid="revision-anterior"
              >
                <span>
                  Revisión {r.number} · {euros(r.total_cents)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
                <Badge tone={ESTADOS_REVISION[r.status].tono}>
                  {ESTADOS_REVISION[r.status].etiqueta}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

type Catalogo = {
  id: string;
  name: string;
  version_id: string | null;
  price_cents: number | null;
}[];

/** Cambio de unas condiciones ya aceptadas: crear, editar, proponer, retirar o descartar. */
function Cambio({
  e,
  catalogo,
  categorias,
}: {
  e: DetalleContratacion;
  catalogo: Catalogo;
  categorias: Categoria[];
}) {
  const c = e.cambio;
  if (!c) {
    return (
      <section
        aria-labelledby="proponer-cambio"
        className="flex flex-col gap-3 border-t border-border pt-5"
      >
        <h3 id="proponer-cambio" className="text-sm font-medium">
          Cambiar las condiciones
        </h3>
        <FormAccion
          accion={accionCrearRevision.bind(null, e.id)}
          boton="Preparar un cambio"
          variante="secondary"
        >
          <Field label="Motivo del cambio" hint="Lo verá el cliente y queda en el historial.">
            <Input name="motivo" required maxLength={500} />
          </Field>
        </FormAccion>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="cambio-condiciones"
      className="flex flex-col gap-4 border-t border-border pt-5"
      data-testid="cambio-condiciones"
    >
      <h3 id="cambio-condiciones" className="flex flex-wrap items-center gap-3 text-sm font-medium">
        Cambio: revisión {c.number}
        <Badge tone={ESTADOS_REVISION[c.status].tono}>{ESTADOS_REVISION[c.status].etiqueta}</Badge>
      </h3>
      {c.reason && <p className="text-sm text-muted">Motivo: {c.reason}</p>}
      {c.status === "borrador" ? (
        <>
          <Editor engagementId={e.id} r={c} catalogo={catalogo} categorias={categorias} />
          <div className="flex flex-wrap gap-2">
            <FormAccion
              accion={accionEstadoRevision.bind(null, e.id, c.id, "propuesta")}
              boton="Proponer al cliente"
            />
            <FormAccion
              accion={accionEstadoRevision.bind(null, e.id, c.id, "descartada")}
              boton="Descartar el cambio"
              variante="ghost"
            />
          </div>
        </>
      ) : (
        <>
          <ResumenCondiciones r={c} />
          <p role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            Esperando a que el cliente lo acepte.
            {e.requires_signature && e.status !== "datos_completos"
              ? " Como el contrato ya está firmado, el cambio se acepta firmando uno nuevo: prepáralo en la sección «Contrato»."
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <FormAccion
              accion={accionEstadoRevision.bind(null, e.id, c.id, "borrador")}
              boton="Retirar para editar"
              variante="secondary"
            />
            <FormAccion
              accion={accionEstadoRevision.bind(null, e.id, c.id, "descartada")}
              boton="Descartar el cambio"
              variante="ghost"
            />
          </div>
        </>
      )}
    </section>
  );
}

/** Edición de unas condiciones en preparación. */
function Editor({
  engagementId,
  r,
  catalogo,
  categorias,
  bloqueado = false,
}: {
  engagementId: string;
  r: Revision;
  catalogo: Catalogo;
  categorias: Categoria[];
  bloqueado?: boolean;
}) {
  if (bloqueado) return <ResumenCondiciones r={r} />;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`servicios-${r.id}`} className="flex flex-col gap-3">
        <h3 id={`servicios-${r.id}`} className="text-sm font-medium">
          Servicios
        </h3>
        {r.lineas.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no hay servicios: añade al menos uno para poder invitar.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {r.lineas.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
                data-testid="linea-editable"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>
                    <strong>{l.name}</strong>{" "}
                    <span className="text-xs text-muted">{l.categoria}</span>
                  </span>
                  <span>
                    {euros(l.unit_price_cents)}
                    {l.discount_cents > 0 && ` − ${euros(l.discount_cents)}`} ={" "}
                    {euros(l.base_cents)} + IVA
                  </span>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                    Editar o quitar
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <FormAccion
                      accion={accionEditarLinea.bind(null, engagementId, l.id)}
                      boton="Guardar servicio"
                      variante="secondary"
                    >
                      <CamposLinea categorias={categorias} l={l} />
                    </FormAccion>
                    <FormAccion
                      accion={accionQuitarLinea.bind(null, engagementId, l.id)}
                      boton="Quitar servicio"
                      variante="ghost"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        {catalogo.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
              Añadir un servicio del catálogo
            </summary>
            <FormAccion
              accion={accionAnadirLineaCatalogo.bind(null, engagementId, r.id)}
              boton="Añadir del catálogo"
              variante="secondary"
              className="mt-3"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Servicio del catálogo">
                  <Select name="servicio" required defaultValue="">
                    <option value="" disabled>
                      Elige un servicio
                    </option>
                    {catalogo.map((s) => (
                      <option key={s.id} value={s.version_id ?? ""}>
                        {s.name} · {euros(s.price_cents ?? 0)} + IVA
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Precio pactado (€, sin IVA)" hint="Vacío: el del catálogo.">
                  <Input name="precio" inputMode="decimal" placeholder="1.500,00" />
                </Field>
              </div>
            </FormAccion>
          </details>
        )}

        <details className="text-sm" open={r.lineas.length === 0 && catalogo.length === 0}>
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
            Añadir un servicio a medida
          </summary>
          <section aria-label="Añadir un servicio a medida" className="mt-3">
            <FormAccion
              accion={accionAnadirLinea.bind(null, engagementId, r.id)}
              boton="Añadir servicio"
              variante="secondary"
            >
              <CamposLinea categorias={categorias} />
            </FormAccion>
          </section>
        </details>
      </section>

      <section aria-labelledby={`pagos-${r.id}`} className="flex flex-col gap-3">
        <h3 id={`pagos-${r.id}`} className="text-sm font-medium">
          Cómo se paga
        </h3>
        {r.hitos.length === 0 ? (
          <p className="text-sm text-muted">Un único pago del total.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {r.hitos.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                data-testid="hito-editable"
              >
                <span>
                  {h.label}{" "}
                  <span className="text-xs text-muted">
                    {h.fixed_cents != null ? "importe fijo" : `parte ${h.weight} del reparto`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <strong>{euros(h.amount_cents)}</strong>
                  <FormAccion
                    accion={accionQuitarHito.bind(null, engagementId, h.id)}
                    boton="Quitar"
                    variante="ghost"
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
        {!r.milestones_valid && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
            Los pagos no suman el total ({euros(r.total_cents)}). Ajusta los importes fijos o añade
            un pago de reparto que se quede con el resto.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <FormAccion
            accion={accionDividirPagos.bind(null, engagementId, r.id)}
            boton="Dividir"
            variante="secondary"
          >
            <Field
              label="Dividir el total en pagos iguales"
              hint="1 = un único pago. Los céntimos sobrantes van al último."
            >
              <Input
                name="partes"
                type="number"
                min={1}
                max={24}
                step={1}
                required
                defaultValue={r.hitos.length || 1}
              />
            </Field>
          </FormAccion>
          <FormAccion
            accion={accionAnadirHito.bind(null, engagementId, r.id)}
            boton="Añadir pago"
            variante="secondary"
          >
            <Field label="Concepto del pago">
              <Input name="etiqueta" required maxLength={120} placeholder="Al empezar" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select name="tipo" defaultValue="reparto">
                  <option value="reparto">Parte del reparto del resto</option>
                  <option value="fijo">Importe fijo (IVA incluido)</option>
                </Select>
              </Field>
              <Field label="Parte o importe" hint="Reparto: 1, 2…  Fijo: 500,00">
                <Input name="valor" inputMode="decimal" defaultValue="1" />
              </Field>
            </div>
          </FormAccion>
        </div>
      </section>

      <FormAccion
        accion={accionCondicionesTexto.bind(null, engagementId, r.id)}
        boton="Guardar condiciones"
        variante="secondary"
      >
        <Field
          label="Condiciones de pago acordadas"
          hint="Plazos, forma de pago, entregas… Van al contrato y las ve el cliente."
        >
          <Textarea
            name="condiciones"
            rows={3}
            maxLength={4000}
            defaultValue={r.conditions ?? ""}
          />
        </Field>
      </FormAccion>

      <section aria-label="Revisión de importes" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Así lo verá el cliente</h3>
        {r.lineas.length > 0 ? (
          <ResumenCondiciones r={r} compacto />
        ) : (
          <p className="text-sm text-muted">Sin servicios todavía.</p>
        )}
      </section>
    </div>
  );
}

function CamposLinea({ categorias, l }: { categorias: Categoria[]; l?: Linea }) {
  const tipo =
    l?.discount_percent != null
      ? "porcentaje"
      : l?.discount_amount_cents != null
        ? "importe"
        : "ninguno";
  const descuento =
    l?.discount_percent != null
      ? String(l.discount_percent).replace(".", ",")
      : l?.discount_amount_cents != null
        ? centimosATexto(l.discount_amount_cents)
        : "";
  const otros = categorias.find((c) => c.name === "Otros servicios personalizados")?.id;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de servicio">
          <Select
            name="categoria"
            required
            defaultValue={l?.category_id ?? otros ?? categorias[0]?.id}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre del servicio">
          <Input name="nombre" required maxLength={200} defaultValue={l?.name ?? ""} />
        </Field>
      </div>
      <Field label="Descripción" hint="Qué incluye. La ve el cliente y va al contrato.">
        <Textarea
          name="descripcion"
          rows={2}
          maxLength={4000}
          defaultValue={l?.description ?? ""}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Precio (€, sin IVA)">
          <Input
            name="precio"
            inputMode="decimal"
            required
            placeholder="1.500,00"
            defaultValue={l ? centimosATexto(l.unit_price_cents) : ""}
          />
        </Field>
        <Field label="IVA (%)">
          <Input
            name="iva"
            inputMode="decimal"
            required
            defaultValue={l ? String(l.vat_rate).replace(".", ",") : "21"}
          />
        </Field>
        <Field label="Descuento">
          <Select name="descuento_tipo" defaultValue={tipo}>
            <option value="ninguno">Sin descuento</option>
            <option value="porcentaje">En %</option>
            <option value="importe">En € (sin IVA)</option>
          </Select>
        </Field>
        <Field label="Valor del descuento">
          <Input name="descuento" inputMode="decimal" defaultValue={descuento} />
        </Field>
      </div>
    </>
  );
}
