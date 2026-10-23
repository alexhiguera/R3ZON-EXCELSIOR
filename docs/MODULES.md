# Estado de los módulos

Qué hay en el proyecto: el core de la plantilla y los módulos instalados. El catálogo de
módulos disponibles y su contrato están en [`modules/README.md`](../modules/README.md).

Leyenda: ✅ completo · 🚧 en curso · ⬜ pendiente.

## Core

| Pieza | Estado | Dónde |
|---|---|---|
| Configuración del proyecto | ✅ | `src/config/project.ts` |
| Sesión y protección de rutas | ✅ | `src/proxy.ts`, `src/lib/supabase/`, `src/lib/public-paths.ts` |
| Login, callback y logout | ✅ | `src/app/(auth)/login/`, `src/app/auth/` |
| Página protegida mínima | ✅ | `src/app/(app)/inicio/` |
| `public.profiles` + RLS + triggers | ✅ | `supabase/migrations/` |
| Prisma (introspección y drift) | ✅ | `scripts/prisma-db.mjs` |
| UI base accesible (Button, Field, Input, Card, Badge, Stepper) y tema de r3zon.com | ✅ | `src/components/ui/`, `src/app/globals.css` |
| Armazón responsive de la zona con sesión y navegación declarada | ✅ | `src/components/app-shell/`, `src/config/navegacion.ts` |
| Observabilidad (Sentry, Speed Insights, logger, health) | ✅ | `src/lib/observability/`, `src/instrumentation*.ts` |
| Tests: unitarios, componentes, a11y, BD, E2E | ✅ | `tests/`, `e2e/` |
| CI: calidad, E2E, seguridad | ✅ | `.github/workflows/` |
| `public_docs/` con contrato y validador | ✅ | `public_docs/`, `scripts/validar-public-docs.mjs` |
| Documentación interna | ✅ | `docs/` |

## Módulos instalados

Ninguno.

Al instalar uno, añade una fila. «Versión de la plantilla» es la de
[`r3zon-template.json`](../r3zon-template.json) de la que se tomó el módulo
([TEMPLATE.md](TEMPLATE.md)):

| Módulo | Versión de la plantilla | Fecha | Adaptaciones |
|---|---|---|---|
| — | — | — | — |

### Previstos

Módulos del catálogo de la plantilla que Excelsior necesitará, y en qué fase
([PLAN.md](PLAN.md)). Ninguno existe aún en la plantilla: se construirán aquí respetando
su contrato ([`modules/README.md`](../modules/README.md)) y lo que sirva a otros
productos se propondrá después para la plantilla.

| Módulo | Fase | Para qué en Excelsior |
|---|---|---|
| `auth-advanced` | 1 | Invitaciones, Google OAuth, recuperación y cambio de contraseña, 2FA del staff |
| `multi-tenancy` | 1 | Empresa cliente = organización; pertenencia y RLS por organización |
| `roles-permissions` | 1 | Nivel de plataforma (staff / cliente) × rol en la empresa ([ROLES.md](ROLES.md)) |
| `email-resend` | 1 | Emails de Auth y transaccionales con la marca de R3ZON |
| `audit-log` | 1 | Logins, invitaciones, firmas, cambios de rol, «ver como cliente» |
| `billing-stripe` | 4 | Pagos únicos, señal + entrega, transferencia/SEPA/tarjeta, facturas y (Fase 6) suscripciones |
| `file-storage` | 5 | Contratos firmados, materiales del briefing, zona de documentos |
| `legal-consent` | MVP | Páginas legales del portal y consentimiento si hay analítica |
| `backups` | MVP | Base **y Storage** (contratos firmados) |
| `whats-new` | 6 | Anunciar a los clientes los apartados nuevos (`CLAUDE.md` §8) |

## Módulos de negocio del producto

Secciones propias de Excelsior. Detalle de cada una en [PLAN.md](PLAN.md).

| Módulo | Fase | Estado | Notas |
|---|---|---|---|
| Organizaciones y usuarios | 1 | 🚧 | Base hecha (empresas, miembros, niveles, audit log); falta «Mi cuenta» y el selector de empresa |
| Invitaciones | 1–2 | 🚧 | Alta y aceptación hechas; falta el envío por email y el servicio preseleccionado (Fase 2) |
| Panel de administración | 2 | ✅ | `/admin`: clientes (alta, alta con invitación, ficha, archivo, ver como cliente), servicios, contrataciones, contratos |
| Catálogo de servicios | 2 | ✅ | `src/modulos/servicios`: versiones inmutables, precio, IVA, modalidades, señal. Las plantillas de contrato y briefing llegan en las fases 3 y 5 |
| Contrataciones | 2–4 | 🚧 | `src/modulos/contrataciones`: máquina de estados completa, invitación con servicio, embudo y cierres manuales. Los pasos del cliente (datos, firma, pago), en las fases 3 y 4 |
| RGPD | MVP | ⬜ | Exportación, importación, bloqueo legal y supresión ([RGPD.md](RGPD.md)) |
| Asistente de onboarding | 3–4 | ✅ | `/bienvenida/[id]`: bienvenida, datos fiscales, [contrato y firma], [pago], listo; los pasos dependen de los interruptores (T-27) |
| Contratos y firma | 3 | ✅ | `src/modulos/contratos`: plantillas, cláusulas, anexos, firma con código y evidencias, PDF ([ARCHITECTURE.md](ARCHITECTURE.md) §17) |
| Cobros | 4 | 🚧 | `src/modulos/cobros`: libro de cobros, cobros externos, estado económico, revisión, modalidad y señal + entrega. Falta Stripe (embebido, T-30); la factura, en ANTARES (T-29) |
| Proyectos y briefing | 5 | 🚧 | `src/modulos/proyectos`: proyecto al completar el alta, plantilla de briefing por servicio, briefing con texto, color, tipografía y enlace, revisión de R3ZON. Falta el tipo «fichero» (T-33) y los recordatorios |
| Documentos | 5 | ⬜ | Zona tipo Drive por proyecto |
| Propuestas y presupuestos | 6 | ⬜ | Aceptar → firmar → pagar |
| Planes y mejoras | 6 | ⬜ | Suscripciones, cambio de plan |
| Notificaciones | 6 | ⬜ | En el portal y por email |
| Tickets | 7 | ⬜ | Soporte con SLA por plan |
| Integración ANTARES | 8 | ⬜ | Emisión de facturas certificadas |
