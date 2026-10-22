# R3ZON SaaS Template

Plantilla oficial de proyectos SaaS de **R3ZON**. No es un producto: es el punto de
partida común para que cada producto nuevo nazca con las mismas tecnologías,
arquitectura, controles de calidad, documentación y forma de trabajar.

```text
R3ZON SaaS Template → proyecto nuevo → definición del producto → módulos necesarios → desarrollo
```

**Versión:** la de [`r3zon-template.json`](r3zon-template.json). Qué significa, cómo se
crea un proyecto y cómo se actualiza: [`docs/TEMPLATE.md`](docs/TEMPLATE.md).

Qué trae y por qué: [`docs/README.md`](docs/README.md). Cómo trabajar en el repo (personas
y agentes): [`CLAUDE.md`](CLAUDE.md).

## Qué incluye

- **App:** Next.js 16 (App Router, `proxy.ts`) · TypeScript estricto · Tailwind CSS 4 ·
  lucide-react · Zod.
- **Datos y auth:** Supabase (Postgres 17, Auth, RLS) · migraciones como única fuente
  del esquema · Prisma solo para introspección y drift · `public.profiles` como única
  tabla del core.
- **Auth mínima:** login con email y contraseña, callback, logout, protección de rutas
  con lista explícita de rutas públicas.
- **Calidad:** Biome · Vitest + Testing Library + jest-axe · tests de RLS contra
  Postgres real · Playwright contra el build de producción.
- **CI:** GitHub Actions (`ci.yml`, `e2e.yml`, `security.yml`).
- **Observabilidad:** Sentry (apagado sin DSN, sin datos personales) · Vercel Speed
  Insights.
- **Documentación:** `docs/` interna · `public_docs/` pública, lista para el Docusaurus
  de R3ZON.
- **Módulos opcionales:** catálogo y contrato en [`modules/`](modules/README.md), sin
  implementar todavía.

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

---

## Crear un proyecto nuevo desde la plantilla

Procedimiento completo en [`docs/TEMPLATE.md`](docs/TEMPLATE.md). En resumen:

1. **GitHub → *Use this template*** (no un fork). `r3zon-template.json` registra de qué
   versión nace el proyecto; no se toca.
2. **Personalizar la identidad** en [`src/config/project.ts`](src/config/project.ts) y en
   los ficheros que la repiten (`package.json`, `supabase/config.toml` con puertos
   propios, `public_docs/_meta/`, `public_docs/index.md`). `npm run docs:validar` y los
   tests fallan mientras no coincidan.
3. **Documentación al derivar**: vaciar la bitácora, las tareas, `auditoria.md` y
   `mejoras.md` de la plantilla, y borrar `docs/auditoria-template-final.md`.
4. **Arrancar** (`npm ci && npm run dev:setup`), dar de alta los servicios
   ([`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)) y elegir módulos
   ([`modules/README.md`](modules/README.md)).
5. **Primer módulo de negocio de punta a punta** (tabla + RLS + UI + tests + E2E +
   documentación). Es la referencia de todos los demás.

Para incorporar después una versión nueva de la plantilla: [`docs/TEMPLATE.md`](docs/TEMPLATE.md)
→ «Actualizar un proyecto».

---

## Origen

La plantilla destila la experiencia de **R3ZON ANTARES**, el primer producto de R3ZON:
qué decisiones funcionaron, qué problemas aparecieron y cómo se resolvieron. Las
decisiones y su origen están en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). La
plantilla no depende de ANTARES en nada.
