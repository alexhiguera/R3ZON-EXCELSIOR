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
| `npm run test:run` (con el stack levantado) | ✅ 264 tests en 34 ficheros (93 contra Postgres) |
| `npm run test:e2e` | ✅ 36 tests (18 en escritorio + 18 en móvil), incluido el alta completa con firma |
| `npm run build` | ✅ |
| `npm run db:drift` · `db:types:check` | ✅ |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades |
| Migraciones | 8: core + 7 módulos (línea base, T-18), solo en local |
| Entorno | **Solo local** (T-17) |
| Fase en curso | **Fase 3** — recorrido completo hecho; faltan las validaciones de la asesoría. Siguiente: Fase 4 (pagos) |

## Fase 3 — Onboarding y contrato

- [ ] 🔴 Validación jurídica de la firma y de las evidencias (D-10) **antes de firmar un
  contrato real**. Llevar a la asesoría `ARCHITECTURE.md` §17 y un PDF de muestra.
- [ ] 🟠 Textos reales: plantilla marco, cláusulas (incluida la de encargado del
  tratamiento, D-05) y datos de R3ZON (en `/admin/contratos`).
- [ ] 🟡 Los formularios de crear cuenta, aceptar invitación y login vacían los campos al
  fallar (comportamiento por defecto de React 19 con `action`). `FormAccion` ya lo evita;
  pasarlos a ese patrón.
- [ ] 🟡 Validar el NIF intracomunitario en VIES para clientes de la UE (necesita red:
  al salir de local).
- [ ] 🟢 Al cambiar a una versión nueva de una cláusula, el contrato en borrador que usaba
  la anterior la muestra desactivada; volver a activarla usa la vigente.

## Fase 1 — Acceso (aparcadas por R3ZON, 2026-10-23)

- [ ] 🔴 Recuperación de contraseña (`/recuperar` → callback `recovery` → nueva
  contraseña). En local los emails van a Mailpit (`http://127.0.0.1:55424`).
- [ ] 🔴 «Mi cuenta»: nombre, cambio de contraseña pidiendo la actual.
- [ ] 🔴 2FA (TOTP) obligatorio para el staff (hallazgo A1-10 de [auditoria.md](auditoria.md)):
  antes del primer cliente real. Con él, las policies de staff exigirán `aal2`.
- [ ] 🟠 Selector de empresa para quien pertenece a varias (T-13).
- [ ] 🟡 Decidir si «Cerrar sesión» cierra solo este dispositivo o todos (**aparcada**).
  Hoy `signOut()` sin `scope` cierra todas; los E2E van con un solo worker por eso.
- [ ] 🟡 Probar «Continuar con Google» con una cuenta real (necesita credenciales de
  Google Cloud; pasos en [DEVELOPMENT.md](DEVELOPMENT.md)).
- [ ] 🟢 Emails con la marca (invitación, recuperación) vía Resend: aplazado mientras todo
  sea local (T-17). Mientras, el enlace se copia desde el panel.

## RGPD y conservación ([RGPD.md](RGPD.md))

- [ ] 🔴 Módulo `rgpd`: exportación (acceso y portabilidad) e importación, bloqueo legal y
  supresión. Antes del primer cliente real.
- [ ] 🟠 Tareas programadas de purga: invitaciones cerradas (plazo en D-13) y registro de
  actividad de más de 6 años (`audit_log_purge`).
- [ ] 🟠 Registro de actividades de tratamiento, política de privacidad y procedimiento
  de brechas (con la asesoría).

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
