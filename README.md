# Excelsior — R3ZON Clientes

El **área de clientes de R3ZON**, en [`clientes.r3zon.com`](https://clientes.r3zon.com):
la parte privada de r3zon.com donde un cliente entra por invitación, firma su contrato,
paga, aporta los materiales de su proyecto y, después, sigue sus servicios, propuestas,
documentos y tickets. «Excelsior» es el nombre interno del proyecto.

- **Qué es y por qué:** [`docs/PRODUCTO.md`](docs/PRODUCTO.md).
- **Plan por fases y decisiones:** [`docs/PLAN.md`](docs/PLAN.md).
- **Estado de hoy:** [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md).
- **Cómo se trabaja en el repo** (personas y agentes): [`CLAUDE.md`](CLAUDE.md).
- **Toda la documentación interna:** [`docs/README.md`](docs/README.md).

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 con la marca de r3zon.com · Supabase (Postgres,
Auth, RLS, Storage) · Stripe · Vercel. Nace de la plantilla de proyectos SaaS de R3ZON,
versión en [`r3zon-template.json`](r3zon-template.json); cómo incorporar versiones nuevas
de la plantilla: [`docs/TEMPLATE.md`](docs/TEMPLATE.md).

## Arranque rápido

Requisitos: Node 24 (`nvm use`), Docker en marcha.

```bash
npm ci
npm run dev:setup   # Supabase local + .env.local + usuario de desarrollo
npm run dev         # http://localhost:3000
```

Guía completa: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Comprobaciones

```bash
npm run lint && npm run typecheck && npm run test:run   # siempre
npm run db:drift && npm run db:types:check              # si tocas la base
npm run test:e2e                                        # si tocas rutas o auth (resetea la base local)
npm run docs:validar && npm run docs:enlaces            # si tocas documentación o la identidad
npm run build
```
