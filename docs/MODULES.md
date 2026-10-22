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
| UI base accesible (Button, Field, Input) y tema | ✅ | `src/components/ui/`, `src/app/globals.css` |
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

## Módulos de negocio del producto

_Los define cada producto._ Ejemplo de formato:

| Módulo | Estado | Notas |
|---|---|---|
| — | — | — |
