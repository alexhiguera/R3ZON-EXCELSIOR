# Estructura del repositorio

```text
├── CLAUDE.md                 reglas de trabajo (personas y agentes)
├── README.md                 qué es + resumen de cómo crear un proyecto
├── r3zon-template.json       versión del core de la plantilla (docs/TEMPLATE.md)
├── src/
│   ├── config/project.ts     ÚNICO punto con la identidad del producto
│   ├── config/navegacion.ts  secciones de la zona con sesión (añadir apartado = añadir entrada)
│   ├── proxy.ts              proxy de Next 16: refresco de sesión + gate de rutas
│   ├── instrumentation.ts    Sentry en servidor/edge (solo con DSN)
│   ├── instrumentation-client.ts   Sentry en navegador (carga diferida, solo con DSN)
│   ├── app/
│   │   ├── layout.tsx        <html lang>, metadatos, Speed Insights
│   │   ├── globals.css       Tailwind 4 + tokens de tema
│   │   ├── page.tsx          portada pública
│   │   ├── (auth)/login/     login: page + LoginForm (cliente) + actions (Server Action)
│   │   ├── auth/callback/    enlaces de Supabase Auth → sesión
│   │   ├── auth/logout/      POST → cerrar sesión
│   │   ├── (app)/            zona con sesión: layout con 2ª comprobación + inicio/
│   │   ├── api/health/       comprobación de vida
│   │   ├── robots.ts · sitemap.ts
│   │   └── error.tsx · global-error.tsx · not-found.tsx
│   ├── components/ui/        primitivos accesibles: Button, Field, Input, Card, Badge, Stepper
│   ├── components/app-shell/ armazón con sesión (AppShell, NavLinks) y de acceso (AuthLayout)
│   ├── components/brand/     logotipo de R3ZON
│   └── lib/
│       ├── supabase/         client.ts (navegador) · server.ts · proxy.ts
│       ├── public-paths.ts   lista de rutas sin sesión
│       ├── safe-redirect.ts  redirecciones solo dentro del sitio
│       ├── env.ts            variables públicas validadas con Zod
│       ├── logger.ts         logger JSON con redacción de secretos
│       ├── observability/    opciones de Sentry y limpieza de eventos
│       ├── database.types.ts GENERADO (npm run db:types)
│       └── utils.ts          cn()
├── supabase/
│   ├── config.toml           stack local (project_id y puertos propios)
│   ├── migrations/           ÚNICA fuente del esquema
│   └── seed.sql              vacío a propósito
├── prisma/schema.prisma      GENERADO por introspección (npm run db:pull)
├── tests/
│   ├── unit/                 lógica pura
│   ├── components/           Testing Library + jest-axe
│   ├── db/                   contra Postgres real: RLS, triggers, grants, catálogo
│   ├── _fixtures/            proyecto ficticio autocontenido para probar validadores
│   └── public-docs.test.ts   el validador de public_docs
├── e2e/
│   ├── specs/                Playwright
│   └── support/              datos compartidos con los scripts de siembra
├── scripts/                  herramientas de operación (.mjs, sin dependencias extra)
│   └── lib/                  piezas puras, probadas en tests/unit
├── docs/                     documentación interna
├── public_docs/              documentación pública (la publica el Docusaurus)
├── modules/                  contrato y catálogo de módulos opcionales
├── .github/workflows/        ci.yml · e2e.yml · security.yml
└── .claude/settings.json     permisos de Claude Code para el repo
```

## Dónde va cada cosa

| Qué | Dónde | Por qué |
|---|---|---|
| Identidad del producto (nombre, dominio, idioma) | `src/config/project.ts` | Fuente única; los JSON que la repiten los valida `docs:validar` ([TEMPLATE.md](TEMPLATE.md)) |
| Variable de entorno nueva | `src/lib/env.ts` (pública) o el módulo de servidor que la usa | Procedimiento en [DEVELOPMENT.md](DEVELOPMENT.md) |
| Página pública nueva | `src/app/…` + `src/lib/public-paths.ts` + su test | Todo lo que no está en la lista exige sesión |
| Página con sesión | `src/app/(app)/…` | El layout del grupo añade la segunda comprobación |
| Lógica de dominio | `src/lib/<dominio>.ts`, pura | Se prueba sin montar nada |
| Hooks de React | `src/lib/use*.ts(x)` | |
| Componentes de un módulo de negocio | `src/components/<modulo>/` | |
| Cambio de esquema | migración nueva en `supabase/migrations/` | Nunca en otro sitio |
| Herramienta de operación | `scripts/*.mjs` (lógica testeable en `scripts/lib/`) | |

## Rutas previstas en Excelsior

> **Previsto.** Mapa de rutas del plan ([PLAN.md](PLAN.md)); hoy solo existen las de la
> plantilla. Los nombres visibles van en español (convención de abajo).

```text
src/app/
├── (auth)/login/                 email + contraseña y «Continuar con Google»     Fase 1
├── (auth)/recuperar/             recuperación de contraseña (pública)            Fase 1
├── invitacion/[token]/           aceptar invitación y crear cuenta (pública)     Fase 1
├── legal/…                       aviso legal, privacidad, cookies (públicas)     MVP
├── api/stripe/webhook/           webhook de Stripe (firma verificada)            Fase 4
└── (app)/
    ├── inicio/                   pendientes y actividad del cliente              Fase 6 (mínimo antes)
    ├── bienvenida/[contratacion]/  asistente: bienvenida → datos → contrato →
    │                             firma → pago → enhorabuena                      Fases 3–4
    ├── servicios/                servicios contratados y mejorar plan            Fase 6
    ├── proyectos/[id]/           fases, briefing y documentos                    Fase 5
    ├── contratos/                firmados y pendientes                           Fase 3
    ├── propuestas/               presupuestos: ver, aceptar, rechazar            Fase 6
    ├── facturas/                 facturas y pagos pendientes                     Fase 4
    ├── soporte/                  tickets                                         Fase 7
    ├── empresa/                  datos fiscales y usuarios de la empresa         Fases 3 y 6
    ├── cuenta/                   perfil, contraseña, Google, 2FA                 Fase 1
    └── admin/                    SOLO STAFF                                      Fase 2
        ├── clientes/             listado, alta, ficha, ver como cliente
        ├── invitaciones/         generar con servicio, reenviar, revocar
        ├── servicios/            catálogo y versiones
        ├── contratos/            plantillas y estado de firma
        ├── pagos/                cobros pendientes, marcar entrega
        └── soporte/              bandeja de tickets
```

Lógica de dominio en `src/lib/<seccion>/` y componentes en `src/components/<seccion>/`,
uno por apartado ([ARCHITECTURE.md](ARCHITECTURE.md) §15).

## Convención de nombres

- **Infraestructura técnica en inglés**: `proxy.ts`, `safe-redirect.ts`, `useMediaQuery`.
- **Dominio en el idioma del producto**: rutas visibles (`/inicio`), ficheros y funciones
  de negocio (`pedidos.ts`, `crearPedido` en un producto en español).
- **Scripts propios de operación y documentación de R3ZON en español**
  (`validar-public-docs.mjs`, `verificar-overrides.mjs`).
- **Tests**: el nombre del `it()` describe el comportamiento en el idioma del equipo
  (español), porque se lee como especificación.

Mezclar idiomas una vez es feo; ser inconsistente es feo cada día.
