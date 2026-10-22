# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

Las fases y su orden están en [PLAN.md](PLAN.md). Aquí solo entran las tareas de la fase
en curso (y lo que surja); cuando arranca una fase, sus entregables bajan aquí.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

## Estado hoy — *2026-10-23*

| Comprobación | Resultado |
|---|---|
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` (con el stack levantado) | ✅ 150 tests en 18 ficheros (también con los datos que dejan los E2E) |
| `npm run test:e2e` | ✅ 30 tests (15 en escritorio + 15 en móvil) |
| `npm run build` | ✅ |
| `npm run db:drift` · `db:types:check` | ✅ |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| Migraciones | 3 (`core_profiles`, `uuidv7`, `organizations_invitations`), solo en local |
| Entorno | **Solo local** (T-17). Sin producción ni servicios externos |
| Fase en curso | **Fase 1** — hechos el modelo de empresas y roles, las invitaciones y el alta solo por invitación |

## Fase 1 — Acceso

- [ ] 🔴 Recuperación de contraseña (`/recuperar` → callback `recovery` → nueva
  contraseña). En local los emails van a Mailpit (`http://127.0.0.1:55424`).
- [ ] 🔴 «Mi cuenta»: nombre, cambio de contraseña pidiendo la actual.
- [ ] 🟠 2FA (TOTP) obligatorio para el staff.
- [ ] 🟠 Selector de empresa para quien pertenece a varias (T-13). Hoy el inicio las
  lista todas; hará falta al aparecer datos por empresa (Fase 2).
- [ ] 🟡 Decidir si «Cerrar sesión» cierra solo este dispositivo o todos (**aparcada** por
  R3ZON). Hoy `auth/logout` llama a `signOut()` sin `scope`, que cierra **todas** las
  sesiones; los E2E van con un solo worker por eso.
- [ ] 🟡 Probar «Continuar con Google» con una cuenta real (necesita un cliente OAuth de
  Google Cloud; pasos en [DEVELOPMENT.md](DEVELOPMENT.md)). Hook y alta ya probados con
  eventos `google` contra Postgres.
- [ ] 🟢 Emails con la marca (invitación, recuperación) vía Resend: aplazado mientras todo
  sea local (T-17). Mientras, el enlace de invitación sale de `npm run dev:invitar`.

## Al salir de local (aplazado, T-17)

- [ ] Dar de alta los servicios: Supabase Cloud (UE, **con el hook activado en el panel**),
  Vercel con `clientes.r3zon.com`, Sentry, Stripe (modo test), Resend, Google Cloud.
- [ ] Primera ejecución de los workflows de CI en GitHub.

## Asesoría (no depende de que sea local)

- [ ] 🟠 Pedir ya lo que bloquea el Hito V, porque tarda: validación de la firma propia
  (D-10), validación fiscal de Stripe Invoicing (D-11), textos de contrato y DPA (D-05) y
  plazos de retención (D-13) ([PLAN.md](PLAN.md) → Decisiones abiertas).

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
