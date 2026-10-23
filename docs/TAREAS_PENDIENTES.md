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
| `npm run test:run` (con el stack levantado) | ✅ 364 tests en 38 ficheros (146 contra Postgres) |
| `npm run test:e2e` | ✅ 42 tests (21 en escritorio + 21 en móvil): alta con firma, cliente ya pagado sin firma, condiciones a medida con hitos y cambio, y briefing |
| `npm run build` | ✅ |
| `npm run db:drift` · `db:types:check` | ✅ |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades |
| Migraciones | 11: core + 10 módulos (línea base, T-18), solo en local |
| Entorno | **Solo local** (T-17) |
| Fase en curso | **Fases 4 y 5** — cobros (sin Stripe, que espera a una cuenta de pruebas) y proyecto con briefing (sin ficheros, T-33). De la Fase 3 faltan las validaciones de la asesoría |

## Fase 4 — Cobros

- [ ] 🔴 Cuenta de Stripe en modo test: bloquea la integración (pago embebido, T-30;
  [PLAN.md](PLAN.md) → Fase 4, 8 y 10).
- [ ] 🟠 Contrato con ANTARES (D-06): quién escucha a Stripe y cómo vuelve la referencia
  de la factura, también para los cobros externos.
- [ ] 🟠 Confirmar con ANTARES la política de redondeo (IVA por tipo sobre la suma de
  bases, medio céntimo hacia arriba; ARCHITECTURE §18) antes de la primera factura real.
- [ ] 🟡 Condiciones: reordenar servicios y editar un hito (hoy: añadir, editar servicios
  y quitar); archivar tipos de servicio desde el panel.
- [ ] 🟡 Mostrar al cliente, en un cambio de condiciones, la comparación línea a línea con
  las vigentes (hoy: total anterior y nuevo, y el detalle nuevo).
- [ ] 🟡 Pago delegado a un usuario `billing` (resto de T-25).
- [ ] 🟡 Requisitos del informe que no llegaron (Apple Pay, Google Pay, Link, descuentos,
  financiación externa): pedírselos a R3ZON antes de la parte de Stripe.
- [ ] 🟢 Justificante de un cobro externo como fichero (hoy es una referencia de texto):
  con el almacenamiento seguro de la Fase 5.

## Fase 5 — Proyecto y briefing

- [ ] 🟠 Ficheros (T-33): decidir el antivirus y la cuarentena, y con ello el tipo
  «fichero» del briefing (logo, imágenes), la zona de documentos y el ZIP del panel.
- [ ] 🟡 Plantillas de briefing reales por servicio (hoy cada servicio nace sin ella),
  incluidos los datos para textos legales (entregable 4).
- [ ] 🟡 Recordatorio por email del briefing incompleto (aplazado con los emails, T-17).
- [ ] 🟢 Reordenar y editar elementos de la plantilla (hoy: añadir al final y quitar).
- [ ] 🟢 Proponer para la plantilla el `aria-label` propio de la barra inferior
  (`AppShell`, core).

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
  (D-10), textos de contrato y DPA (D-05) y
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
