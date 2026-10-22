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
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` (con el stack levantado) | ✅ 107 tests en 14 ficheros (89 sin BD + 18 contra Postgres) |
| `npm run test:e2e` | ✅ 16 tests (8 en escritorio + 8 en móvil) |
| `npm run build` | ✅ |
| `npm run db:drift` · `db:types:check` | ✅ |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades |
| Identidad | Excelsior · «R3ZON Clientes» · `clientes.r3zon.com` · puertos 5542x |
| Migraciones | 1 (`core_profiles`, de la plantilla), solo en local |
| Producción | No existe. Sin clientes reales |
| Fase en curso | **Fase 0** — quedan los servicios externos, el CI en GitHub y las consultas a la asesoría |

## Fase 0 — Adaptar el repositorio y cimientos

- [ ] 🟠 Dar de alta los servicios: Supabase Cloud (UE), Vercel con
  `clientes.r3zon.com`, Sentry, Stripe (modo test), Resend (dominio verificado), Google
  Cloud (OAuth). Requiere las cuentas de R3ZON: lo hace una persona.
- [ ] 🟠 Primera ejecución de los workflows de CI en GitHub (necesita push).
- [ ] 🟠 Pedir ya a la asesoría lo que bloquea el Hito V, porque tarda: validación de la
  firma propia (D-10), validación fiscal de Stripe Invoicing (D-11), textos de contrato
  y DPA (D-05) y plazos de retención (D-13) ([PLAN.md](PLAN.md) → Decisiones abiertas).

## Fase 1 — Preparación

- [ ] 🟡 Decidir si «Cerrar sesión» cierra solo este dispositivo o todos. Hoy
  `auth/logout` llama a `signOut()` sin `scope`, que en Supabase cierra **todas** las
  sesiones del usuario. Con «Mi cuenta → cerrar otras sesiones» (Fase 1), lo natural es
  que el botón normal cierre solo la actual (`scope: "local"`). Cambia los E2E (hoy
  dependen de un solo worker por esto).

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
