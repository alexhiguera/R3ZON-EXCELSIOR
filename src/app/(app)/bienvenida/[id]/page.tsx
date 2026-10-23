import { Check, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BloqueNoDisponible } from "@/components/app-shell/ModuloSeguro";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormAccion } from "@/components/ui/FormAccion";
import { Input, Select } from "@/components/ui/Input";
import { type Step, Stepper } from "@/components/ui/Stepper";
import { euros, fecha } from "@/lib/formato";
import { ESTADOS_COBRO, ETIQUETA_METODO } from "@/modulos/cobros";
import { importeExigible, pagos, resumenCobro } from "@/modulos/cobros/servidor";
import { type PasoAlta, pasosAlta } from "@/modulos/contrataciones";
import { contratacion, type DetalleContratacion } from "@/modulos/contrataciones/servidor";
import { FirmaDibujada, TextoContrato } from "@/modulos/contratos";
import { contratoDe, textoContrato } from "@/modulos/contratos/servidor";
import { datosFiscales, type RolEmpresa, rolEnEmpresa } from "@/modulos/organizaciones/servidor";
import { ETIQUETA_PLAN } from "@/modulos/servicios";
import { accionDelegar, accionEnviarCodigo, accionFirmar, accionGuardarDatos } from "./actions";

export const metadata: Metadata = { title: "Tu alta" };

const ETIQUETAS: Record<PasoAlta, string> = {
  bienvenida: "Bienvenida",
  datos: "Datos de tu empresa",
  contrato: "Contrato",
  pago: "Pago",
  listo: "Listo",
};

/**
 * Asistente de alta. Sus pasos dependen de lo que R3ZON pidió (firmar y pagar
 * en el portal: T-27) y del estado real (`pasosAlta`). El paso no lo decide la
 * URL: `?paso=` solo puede ir a uno ya alcanzado. Los permisos (rol, estado,
 * código) los vuelve a comprobar la base en cada acción.
 */
export default async function BienvenidaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const { id } = await params;
  const { paso: pedido } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const r = await contratacion(id);
  if (!r.ok) return <BloqueNoDisponible nombre="Tu alta" />;
  if (!r.datos) notFound();
  const e = r.datos;
  if (["borrador", "cancelada", "rescindida"].includes(e.status)) notFound();

  const [rol, exigible] = await Promise.all([
    rolEnEmpresa(e.organization_id),
    importeExigible(e.id),
  ]);
  const miRol = rol.ok ? rol.datos : null;

  const { pasos, maximo, porDefecto } = pasosAlta({
    status: e.status,
    requiresSignature: e.requires_signature,
    requiresPayment: e.requires_payment,
    pagoPendiente: exigible.ok && exigible.datos > 0,
  });
  const indicePedido = pasos.indexOf(pedido as PasoAlta);
  const actual = indicePedido >= 0 && indicePedido <= maximo ? indicePedido : porDefecto;
  const paso = pasos[actual]!;
  const steps: Step[] = pasos.map((p) => ({ id: p, label: ETIQUETAS[p] }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs tracking-[0.2em] text-lavender uppercase">{e.organizacion}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {paso === "listo" ? "¡Enhorabuena!" : e.servicio}
        </h1>
        <Stepper steps={steps} current={actual} />
      </header>

      {paso === "bienvenida" && <Bienvenida e={e} />}
      {paso === "datos" && <Datos e={e} rol={miRol} />}
      {paso === "contrato" && <PasoContrato e={e} rol={miRol} />}
      {paso === "pago" && <PasoPago e={e} />}
      {paso === "listo" && <Listo e={e} />}
    </div>
  );
}

function Bienvenida({ e }: { e: DetalleContratacion }) {
  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold">
        Gracias por <span className="text-gradient">elegir R3ZON</span>
      </h2>
      <p className="text-muted">
        {e.servicio_resumen ??
          "Estamos encantados de empezar a trabajar contigo. En unos minutos dejamos todo listo."}
      </p>
      {e.incluye.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Qué incluye</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {e.incluye.map((linea) => (
              <li key={linea} className="flex gap-2">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                {linea}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Precio</dt>
          <dd className="font-medium">
            {euros(e.price_cents)} + {e.vat_rate} % IVA
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Modalidades de pago</dt>
          <dd>
            {e.payment_plans
              .map((p) =>
                p === "senal_entrega" && e.deposit_percent
                  ? `${ETIQUETA_PLAN[p]} (${e.deposit_percent} % al firmar)`
                  : ETIQUETA_PLAN[p],
              )
              .join(" o ")}
          </dd>
        </div>
        {e.conditions && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Condiciones acordadas</dt>
            <dd>{e.conditions}</dd>
          </div>
        )}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-medium">Qué viene ahora</h3>
        <ol className="list-inside list-decimal text-sm text-muted">
          <li>Los datos de tu empresa, para el contrato y la factura.</li>
          <li>Revisas y firmas el contrato aquí mismo.</li>
          <li>El pago, y empezamos tu proyecto.</li>
        </ol>
      </div>
      <Link
        href={`/bienvenida/${e.id}?paso=datos`}
        className="inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Empezar
      </Link>
    </Card>
  );
}

async function Datos({ e, rol }: { e: DetalleContratacion; rol: RolEmpresa | null }) {
  const puedeEditar = rol === "owner" || rol === "billing";
  const r = await datosFiscales(e.organization_id);
  if (!r.ok) return <BloqueNoDisponible nombre="Los datos de tu empresa" />;
  const d = r.datos;

  if (!puedeEditar) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Los datos de la empresa los completa su propietario o la persona de facturación. Cuando lo
          hagan, podrás ver aquí el contrato.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Datos de tu empresa</h2>
        <p className="mt-1 text-sm text-muted">
          Los justos para el contrato y la factura. Podrás cambiarlos más adelante.
        </p>
      </div>
      <FormAccion
        accion={accionGuardarDatos.bind(null, e.id, e.organization_id)}
        boton="Guardar y continuar"
      >
        <Field label="Tipo">
          <Select name="entity_type" defaultValue={d?.entity_type ?? "empresa"}>
            <option value="empresa">Empresa (sociedad)</option>
            <option value="autonomo">Autónomo</option>
          </Select>
        </Field>
        <Field label="Razón social o nombre completo">
          <Input
            name="legal_name"
            required
            maxLength={200}
            defaultValue={d?.legal_name ?? ""}
            autoComplete="organization"
          />
        </Field>
        <Field label="NIF / CIF" hint="El de la empresa; si eres autónomo, tu DNI o NIE.">
          <Input name="tax_id" required maxLength={20} defaultValue={d?.tax_id ?? ""} />
        </Field>
        <Field label="Dirección fiscal">
          <Input
            name="address"
            required
            maxLength={300}
            defaultValue={d?.address ?? ""}
            autoComplete="street-address"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código postal">
            <Input
              name="postal_code"
              required
              maxLength={10}
              defaultValue={d?.postal_code ?? ""}
              autoComplete="postal-code"
            />
          </Field>
          <Field label="Población">
            <Input
              name="city"
              required
              maxLength={100}
              defaultValue={d?.city ?? ""}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="Provincia">
            <Input
              name="province"
              maxLength={100}
              defaultValue={d?.province ?? ""}
              autoComplete="address-level1"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="País" hint="Código de dos letras.">
            <Input
              name="country"
              required
              maxLength={2}
              defaultValue={d?.country ?? "ES"}
              autoComplete="country"
            />
          </Field>
          <Field label="Email de facturación" hint="Opcional: si las facturas van a otro email.">
            <Input
              name="billing_email"
              type="email"
              maxLength={200}
              defaultValue={d?.billing_email ?? ""}
            />
          </Field>
        </div>
      </FormAccion>
    </Card>
  );
}

async function PasoContrato({ e, rol }: { e: DetalleContratacion; rol: RolEmpresa | null }) {
  const c = await contratoDe(e.id);
  if (!c.ok) return <BloqueNoDisponible nombre="Tu contrato" />;
  const contrato = c.datos;

  if (contrato?.status !== "enviado") {
    if (contrato?.status === "firmado") return <Listo e={e} />;
    return (
      <Card>
        <h2 className="text-xl font-semibold">Estamos preparando tu contrato</h2>
        <p className="mt-2 text-sm text-muted">
          Ya tenemos tus datos. En cuanto el equipo de R3ZON prepare el contrato, lo verás aquí para
          revisarlo y firmarlo.
        </p>
      </Card>
    );
  }

  const texto = await textoContrato(contrato.id);
  const esPropietario = rol === "owner";
  const puedeDelegar = rol === "owner" || rol === "billing";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-1 text-xl font-semibold">Tu contrato</h2>
        <p className="mb-4 text-sm text-muted">
          Léelo con calma. Es exactamente el texto que vas a firmar; tus datos de firmante se
          completan al firmar.
        </p>
        <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-background/60 p-4 sm:p-6">
          {texto.ok ? (
            <TextoContrato texto={texto.datos} />
          ) : (
            <BloqueNoDisponible nombre="El texto del contrato" />
          )}
        </div>
      </Card>

      {contrato.delegated_email && (
        <p className="text-sm text-muted">
          Enviado a {contrato.delegated_email} para que lo firme.
        </p>
      )}

      {esPropietario ? (
        <Card className="flex flex-col gap-5">
          <h2 className="text-xl font-semibold">Firmar</h2>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              1. Te enviamos un código a tu email para confirmar que eres tú.
            </p>
            <FormAccion
              accion={accionEnviarCodigo}
              boton="Enviarme el código"
              variante="secondary"
            />
          </div>
          <FormAccion accion={accionFirmar.bind(null, e.id, contrato.id)} boton="Firmar contrato">
            <p className="text-sm text-muted">2. Tus datos como firmante y tu firma.</p>
            <Field label="Nombre y apellidos">
              <Input name="nombre" required maxLength={120} autoComplete="name" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="DNI o NIE">
                <Input name="dni" required maxLength={20} />
              </Field>
              <Field label="Cargo en la empresa">
                <Input name="cargo" required maxLength={100} autoComplete="organization-title" />
              </Field>
            </div>
            <FirmaDibujada campoNombre="nombre" />
            <Field label="Código del email" hint="Las 6 cifras que te acabamos de enviar.">
              <Input
                name="codigo"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="acepto"
                required
                className="mt-0.5 size-4 accent-[rgb(var(--rgb-primary))]"
              />
              He leído el contrato y lo acepto. Entiendo que esta firma electrónica me obliga como
              mi firma manuscrita.
            </label>
          </FormAccion>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Firma un propietario de la empresa. Si no eres tú, envíale el contrato desde aquí.
          </p>
        </Card>
      )}

      {puedeDelegar && (
        <details className="surface-card rounded-2xl p-5">
          <summary className="cursor-pointer text-sm font-medium">
            ¿No eres quien firma? Envía el contrato a otra persona
          </summary>
          <p className="mt-3 text-sm text-muted">
            Por ejemplo, el administrador de la empresa. Recibirá su propio acceso como propietario
            y podrá firmar.
          </p>
          <FormAccion
            accion={accionDelegar.bind(null, e.id, contrato.id)}
            boton="Enviar a firmar"
            variante="secondary"
            className="mt-3"
            etiquetaEnlace="Enlace para quien firma"
          >
            <Field label="Email de quien firma">
              <Input name="email" type="email" required />
            </Field>
          </FormAccion>
        </details>
      )}
    </div>
  );
}

async function Listo({ e }: { e: DetalleContratacion }) {
  const [c, cobro] = await Promise.all([contratoDe(e.id), resumenCobro(e.id)]);
  const contrato = c.ok ? c.datos : null;
  const firmado = contrato?.status === "firmado";
  const estadoCobro = cobro.ok ? cobro.datos?.status : undefined;
  const debe =
    e.requires_payment && (estadoCobro === "no_pagado" || estadoCobro === "parcialmente_pagado");

  return (
    <Card className="flex flex-col gap-4" data-testid="paso-listo">
      <h2 className="text-xl font-semibold">
        {firmado ? (
          <>
            Contrato <span className="text-gradient">firmado</span>
          </>
        ) : (
          <>
            Tu alta está <span className="text-gradient">completa</span>
          </>
        )}
      </h2>
      <p className="text-muted">
        Gracias por confiar en R3ZON.{" "}
        {debe
          ? "Te queda un pago pendiente: lo verás en el paso de pago y te avisaremos cuando puedas hacerlo desde aquí."
          : "No tienes nada pendiente: te avisaremos al poner en marcha tu proyecto."}
      </p>
      {firmado && (
        <a
          href={`/contratos/${contrato.id}/pdf`}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand"
          data-testid="descargar-contrato"
        >
          <FileDown aria-hidden="true" className="size-4" />
          Descargar el contrato (PDF)
        </a>
      )}
      <Link href="/inicio" className="text-sm text-brand underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </Card>
  );
}

/**
 * Pago (T-26). Enseña el total, lo ya pagado (también lo cobrado fuera) y lo
 * pendiente, y NUNCA pide lo ya cobrado: el importe lo calcula la base. En
 * revisión no pide nada. El pago online (Stripe) llega con la Fase 4.
 */
async function PasoPago({ e }: { e: DetalleContratacion }) {
  const [resumen, historial, exigible] = await Promise.all([
    resumenCobro(e.id),
    pagos(e.id),
    importeExigible(e.id),
  ]);
  if (!resumen.ok || !resumen.datos || !historial.ok || !exigible.ok) {
    return <BloqueNoDisponible nombre="Tu pago" />;
  }
  const c = resumen.datos;
  const cobrados = historial.datos.filter((p) => p.status === "confirmado");

  return (
    <Card className="flex flex-col gap-5" data-testid="paso-pago">
      <h2 className="text-xl font-semibold">Pago · {ESTADOS_COBRO[c.status].etiqueta}</h2>
      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border p-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Total (IVA incl.)</dt>
          <dd className="font-medium">{euros(c.total_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pagado</dt>
          <dd className="font-medium">{euros(c.paid_cents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pendiente</dt>
          <dd className="font-medium" data-testid="pendiente-cliente">
            {euros(c.status === "pagado" ? 0 : c.balance_cents)}
          </dd>
        </div>
      </dl>

      {cobrados.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Lo que ya has pagado</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {cobrados.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {fecha(p.paid_on)} · {ETIQUETA_METODO[p.method]}
                </span>
                <span>{euros(p.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.status === "pagado" && <p className="text-sm">Está todo pagado. ¡Gracias!</p>}
      {c.status === "pendiente_revision" && (
        <p className="text-sm text-muted">
          Estamos revisando tus pagos para que no se cobre nada dos veces. No tienes que hacer nada:
          te avisaremos.
        </p>
      )}
      {exigible.datos > 0 && (
        <p className="rounded-xl border border-border bg-white/[0.03] p-4 text-sm">
          Te queda por pagar <strong>{euros(exigible.datos)}</strong>. Muy pronto podrás hacerlo
          aquí mismo con tarjeta o SEPA; mientras tanto, el equipo de R3ZON te indicará cómo.
        </p>
      )}
      <Link
        href={`/bienvenida/${e.id}?paso=listo`}
        className="text-sm text-brand underline-offset-4 hover:underline"
      >
        Continuar
      </Link>
    </Card>
  );
}
