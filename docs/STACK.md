# Stack tecnológico

Versiones de la creación de la plantilla (2026-09-23), **actualizadas en Excelsior el
2026-10-23** a las últimas estables o LTS de cada una (ver «Decisiones de versión»).

## Capas

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | RSC, Server Actions y un solo frontend para web (y para escritorio/móvil vía módulos) |
| Lenguaje | **TypeScript 7** estricto, con `noUncheckedIndexedAccess` | Tipos de la BD generados, nunca escritos a mano |
| UI | **Tailwind CSS 4** «CSS-first» + **lucide-react** | Tokens en `:root` como tripletes RGB: tema cambiable en runtime y modificadores de opacidad que siguen funcionando |
| Tipografías | **Inter** y **Sora** con `next/font/google` | Las de r3zon.com. Se descargan en el build y se sirven desde nuestro dominio: el navegador del cliente no llama a Google. El build necesita red |
| Validación | **Zod 4** | Formularios, variables de entorno y cualquier dato que entra |
| Datos y auth | **Supabase** (Postgres 17, Auth, RLS) vía `@supabase/ssr` | La RLS es el motor de seguridad |
| Herramienta de BD | **Prisma 7** (solo CLI) | Introspección, Studio y drift. Nunca Migrate ni Client en la app ([DATABASE.md](DATABASE.md)) |
| Lint y formato | **Biome 2** | Un binario, sin ESLint ni Prettier |
| Tests | **Vitest 5** + Testing Library + **jest-axe** + `pg` | Unitarios, componentes, accesibilidad y BD real |
| E2E | **Playwright** | Contra el build de producción y el Supabase local |
| CI/CD | **GitHub Actions** + **Vercel** | |
| Errores | **Sentry** (`@sentry/nextjs`) | Ver «Observabilidad» |
| Rendimiento | **Vercel Speed Insights** | Ver «Observabilidad» |

Plataforma fijada con `engines` (`node >=24 <25`), `.nvmrc` (`24`) y `browserslist`
explícito en `package.json`. Las versiones mínimas de navegador son las que soporta
Tailwind 4 (`color-mix`, `@property`).

### Decisiones de versión

- **TypeScript 7** (el compilador nativo): Next 16.3 lo acepta y el build y el typecheck
  pasan. Si una herramienta futura necesita la API JavaScript clásica del compilador y
  falla, la salida es fijar TypeScript 6.
- **Prisma 7.10 y no 8**: la etiqueta `latest` de npm apuntaba a una release candidate de
  Prisma 8 el día de la creación. `^7.10.0` no instala pre-releases.
- **Supabase CLI como devDependency** (`supabase`), no `npx supabase@latest`: la versión
  queda fijada en el lockfile y es la misma en todas las máquinas y en CI.

**Actualización 2026-10-23** (todo lo demás, a la última estable):

- **Node 24.22.1** (LTS «Krypton»). Node 26 existe, pero aún no es LTS.
- **Postgres 17**: Supabase todavía no ofrece Postgres 18 (la CLI 2.121 rechaza
  `major_version = 18`). Por eso UUIDv7 va en SQL ([DATABASE.md](DATABASE.md)).
- **Prisma 7.10.1**, no 8: Prisma 8 sigue en *release candidate*.
- **`@types/node` 24.x**, no 26: los tipos van con el runtime.
- **Sentry 11**: ya no usa `@sentry/cli` para los source maps (lo hace
  `@sentry/bundler-plugins`), así que su aprobación de `allowScripts` desaparece.
- **Biome 2.6** trae formateador de Markdown, que quitaba la línea en blanco antes de
  las listas y realineaba todas las tablas de `docs/`: el Markdown queda fuera de Biome
  (`biome.json`).

## Dependencias de la app

La lista la manda `dependencies` de `package.json`; aquí va el motivo de cada una.
`tests/unit/docs.test.ts` falla si aparece una dependencia de runtime que esta tabla no
explica, para que el documento no se quede atrás.

| Dependencia | Para qué |
|---|---|
| `next`, `react`, `react-dom` | El framework |
| `@supabase/ssr`, `@supabase/supabase-js` | Clientes de Supabase con sesión en cookies |
| `zod` | Validación |
| `lucide-react` | Iconos |
| `clsx`, `tailwind-merge` | La función `cn()` para combinar clases |
| `@sentry/nextjs` | Errores (solo se carga con DSN) |
| `@vercel/speed-insights` | Web Vitals |
| `server-only` | Marca el código que solo puede correr en el servidor (las puertas `servidor.ts` de los módulos, `src/lib/origen.ts`): importarlo desde un componente de cliente rompe el build en vez de filtrar código con acceso a datos |

### Previstas en Excelsior

> **Previsto.** No están instaladas. Cada una entra en la tabla de arriba (un test lo
> exige) cuando su fase la instale, con su motivo real.

| Dependencia candidata | Fase | Para qué |
|---|---|---|
| `stripe` (servidor) · `@stripe/stripe-js`, `@stripe/react-stripe-js` (cliente, carga diferida) | 4 | Pagos, webhooks, Payment Element embebido |
| `resend` · `react-email` | 1 | Emails transaccionales con la marca |
| `@react-pdf/renderer` o `pdf-lib` | 3 | PDF del contrato en servidor y hoja de evidencias (elegir al empezar la fase) |
| Un componente de firma dibujada (p. ej. `signature_pad`) | 3 | Firma en el navegador, también táctil |

Todo lo demás es de desarrollo. `@vitejs/plugin-react` no hace falta: Vite transforma el
JSX de los tests por su cuenta (se comprobó al quitarlo).

Cualquier librería de más de ~100 KB entra con carga diferida
(`dynamic(() => import(…), { ssr: false })`). Sentry ya se carga así en el navegador.

### `overrides`

Cada override necesita un motivo real, y `npm run deps:overrides` comprueba si sigue
haciendo falta (quitándolos en un temporal y repitiendo `npm audit`). CI lo ejecuta en
`security.yml` sin romper: un override de más es deuda, no un fallo.

| Override | Motivo (2026-09-23) |
|---|---|
| `mysql2 ^3.24.4` | Transitiva de `prisma`. Las versiones ≤ 3.23 tienen dos avisos HIGH (degradación a contraseña en claro y descompresión sin límite). La plantilla no usa MySQL, pero `npm audit` rompería `security.yml` |
| `deepmerge-ts ^8.0.2` | Transitiva de `@prisma/config`. Las versiones < 8 tienen un aviso HIGH (agotamiento de pila con objetos recursivos) |

Cuando Prisma suba sus rangos, `deps:overrides` los marcará como obsoletos.

### `allowScripts` (npm 11)

npm 11 **omite en silencio** los scripts de instalación de paquetes no aprobados en el
campo `allowScripts` de `package.json`, y cada aprobación va ligada a una **versión
exacta**. Están aprobados los dos que hacen falta:

| Paquete | Qué hace su script | Qué se rompe si no corre |
|---|---|---|
| `prisma`, `@prisma/engines` | Descarga el motor de esquemas | `db:pull` y `db:drift` (y el paso de drift de CI) |

**Procedimiento al actualizar cualquiera de ellos (o al añadir un paquete que traiga
scripts de instalación):**

```bash
npm install prisma@<versión>           # o npm update, o el PR de un bot
npm install-scripts ls                 # lista lo que ha quedado sin aprobar
#   revisa el script del paquete (node_modules/<paquete>/package.json → scripts)
npm install-scripts approve <paquete>  # reescribe la entrada con la versión nueva
npm install-scripts prune              # quita aprobaciones de versiones que ya no están
npm ci && npm run db:drift             # comprueba que el motor funciona
```

`package.json` y `package-lock.json` se commitean juntos. Un paquete nuevo con scripts
**que no hacen falta** se deniega (`npm install-scripts deny <paquete>`) en vez de
dejarlo sin revisar.

## Observabilidad

| Herramienta | ¿Core? | Decisión |
|---|---|---|
| **Sentry** | Sí | Todo producto necesita ver sus errores desde el primer usuario. **Sin DSN no arranca** (local, CI y proyecto recién creado), **no hay DSN en el código**, y no se recoge dato personal: `dataCollection` todo a `false`, sin `setUser`, y un `beforeSend` que borra cookies, cabeceras, querystring y cuerpo y redacta `extra` con el mismo `redact()` del logger. En el navegador se carga con `import()` solo si hay DSN. Los source maps solo se suben si existe `SENTRY_AUTH_TOKEN` |
| **Speed Insights** | Sí | Web Vitals sin cookies ni identificadores, y el hosting estándar es Vercel. Solo envía datos cuando la app corre en Vercel. **Si la política de privacidad de un producto lo trata como analítica sujeta a consentimiento** (ANTARES lo puso detrás del banner de cookies), se mueve detrás de ese banner |
| **Vercel Analytics** | No, módulo `analytics` | Analítica de comportamiento: afecta a la política de privacidad y al consentimiento de cada producto. Es una decisión de producto, no de plantilla |

El logger ([`src/lib/logger.ts`](../src/lib/logger.ts)) escribe una línea JSON por evento,
que Vercel muestra ya parseada, y redacta las claves que suenan a secreto.

`/api/health` responde `{ status, release }` sin tocar la base, para monitores externos.

## Región

`vercel.json` fija `fra1` (Fráncfort) por defecto: datos y funciones en la UE, cerca de
los usuarios de R3ZON y del Supabase en región UE. Un proyecto puede cambiarla
conscientemente si tiene una razón técnica (usuarios en otra región, requisitos de
residencia de datos); la decisión se apunta en su bitácora.
