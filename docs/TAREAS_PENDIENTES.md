# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

Las fases y su orden están en [PLAN.md](PLAN.md). Aquí solo entran las tareas de la fase
en curso (y lo que surja); cuando arranca una fase, sus entregables bajan aquí.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

## Estado hoy — *2026-10-22*

| Comprobación | Resultado |
|---|---|
| Código | El de la plantilla v1.0.0, sin personalizar |
| Documentación | Adaptada a Excelsior; plan por fases en [PLAN.md](PLAN.md) |
| Migraciones | 1 (`core_profiles`, de la plantilla), solo en local |
| Producción | No existe. Sin clientes reales |
| Fase en curso | **Fase 0** — adaptar el repositorio y cimientos |

## Fase 0 — Adaptar el repositorio y cimientos

- [ ] 🔴 Cerrar las decisiones que bloquean las fases 0–1 ([PLAN.md](PLAN.md) →
  Decisiones abiertas): D-01 nombre visible, D-02 invitación atada al email, D-03 roles
  del staff, D-09 usuario en varias empresas.
- [ ] 🔴 Personalizar identidad, puertos (rango propio, no 5532x), `_meta/` y
  `public_docs/index.md` ([TEMPLATE.md](TEMPLATE.md) → Crear un proyecto). `docs:validar`
  y los tests fallan mientras falte algo.
- [ ] 🔴 Rellenar lo que falta de los invariantes de `CLAUDE.md` §0 (entornos reales) y
  reescribir `README.md` para el producto.
- [ ] 🔴 Extraer el sistema visual de r3zon.com (colores, tipografías, radios, sombras,
  modo oscuro) a `src/app/globals.css` y el icono a `src/app/icon.svg`.
- [ ] 🟠 Esqueleto de la interfaz responsive: layout con navegación (lateral en
  escritorio, inferior o cajón en móvil) y componentes base que faltan (Card, Badge,
  Tabs, Dialog, Toast, Stepper, Dropzone), con jest-axe.
- [ ] 🟠 Dar de alta los servicios: Supabase Cloud (UE), Vercel con
  `clientes.r3zon.com`, Sentry, Stripe (modo test), Resend (dominio verificado), Google
  Cloud (OAuth).
- [ ] 🟠 Primera ejecución de los workflows de CI en GitHub.
- [ ] 🟠 Pedir ya a la asesoría lo que bloquea el Hito V, porque tarda: validación de la
  firma propia (D-10), validación fiscal de Stripe Invoicing (D-11), textos de contrato
  y DPA (D-05) y plazos de retención (D-13) ([PLAN.md](PLAN.md) → Decisiones abiertas).

## Heredadas de la plantilla (antes del hito MVP)

- [ ] 🔴 Decidir backups según el plan de Supabase antes de tener datos reales, **incluido
  Storage** ([RESTAURACION.md](RESTAURACION.md), decisión D-07 de [PLAN.md](PLAN.md)).
- [ ] 🟠 Decidir si Speed Insights va detrás de consentimiento según la política de
  privacidad ([STACK.md](STACK.md)).
- [ ] 🟠 Definir la CSP con la lista de terceros: Supabase, Stripe, Sentry, Google, Vercel
  ([mejoras.md](mejoras.md)).
- [ ] 🟢 Decidir si `public_docs/` se publica en el Docusaurus (ayuda para clientes) o se
  queda como manual interno; si se publica, dar de alta el producto en
  `R3ZON-Docusaurus/config/products.ts`.
