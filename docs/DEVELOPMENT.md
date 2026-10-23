# Desarrollo en local

## Requisitos

- **Node 24** (`nvm use`, lee `.nvmrc`). `engines` rechaza otras versiones mayores.
- **Docker** en marcha (Supabase local).
- En **Windows**, trabaja dentro de WSL: el repo en el sistema de ficheros de Linux y
  `npm` ejecutado desde WSL. Instalar desde Windows sobre `\\wsl.localhost\…` es lento y
  deja binarios nativos de la plataforma equivocada.

## Arranque

```bash
npm ci
npm run dev:setup     # idempotente
npm run dev           # http://localhost:3000
```

[`scripts/dev-setup.sh`](../scripts/dev-setup.sh) comprueba Node y Docker, levanta el
Supabase local (aplicando las migraciones), crea `.env.local` desde `.env.example` con las
claves del stack **local** y crea el usuario de desarrollo (`dev@example.test` /
`dev-password-local-only`, configurable con `DEV_EMAIL` y `DEV_PASSWORD`). Nunca toca una
base remota.

Supabase Studio: <http://127.0.0.1:55423>. Emails que envía Auth en local (Mailpit):
<http://127.0.0.1:55424>.

## Scripts

| Script | Qué hace |
|---|---|
| `dev` · `build` · `start` | Next.js |
| `lint` · `lint:fix` · `format` | Biome |
| `typecheck` | `tsc` con [`tsconfig.typecheck.json`](../tsconfig.typecheck.json) (sin `.next/types`: ver su cabecera) |
| `test` · `test:run` · `test:coverage` | Vitest (unitarios, componentes, a11y, BD) |
| `test:db` | Solo los tests de base de datos (`tests/db/`) |
| `test:e2e` · `test:e2e:ui` | Playwright. **Antes resetea la base local** y siembra (`pretest:e2e`) |
| `db:start` · `db:stop` · `db:reset` · `db:status` | Supabase local |
| `db:pull` · `db:drift` · `db:studio` · `db:validate` | Prisma, solo contra la base local ([DATABASE.md](DATABASE.md)) |
| `db:types` · `db:types:check` | Genera los tipos de TypeScript desde la base local / comprueba que están al día |
| `seed:dev` · `seed:e2e` | Usuarios en el Supabase local, vía la API de Auth |
| `docs:validar` | Valida `public_docs/` contra el contrato y la identidad contra `project.ts` |
| `docs:enlaces` | Enlaces rotos en `docs/`, `modules/`, `README.md` y `CLAUDE.md` |
| `deps:overrides` | ¿Siguen haciendo falta los `overrides`? |
| `dev:setup` | Bootstrap del entorno |
| `dev:invitar -- <email> ["Empresa"] [rol]` | Crea una invitación en local e imprime el enlace (hasta que exista el panel) |
| `dev:staff -- <email> [admin\|staff\|client]` | Cambia el nivel de un usuario local |

## Tests

```bash
npm run test:run      # todo Vitest; los de BD necesitan el stack levantado
npm run test:db       # solo los de BD
npm run test:e2e      # build de producción + Playwright contra el Supabase local
```

Playwright ejecuta cada recorrido dos veces, en **escritorio** y en **móvil** (Pixel 7),
con un solo worker: los dos proyectos usan el mismo usuario y el logout cierra su sesión
en todos los dispositivos.

> **`npm run test:e2e` reinicia la base de datos local y elimina los datos de
> desarrollo**, incluido el usuario `dev@`. Es a propósito: los E2E tienen que partir
> siempre del mismo estado para ser reproducibles. Al terminar, recupera tu usuario con
> `npm run seed:dev`. Si tienes datos locales que quieras conservar, no lances los E2E
> en esa base.

- Unitarios en `tests/unit/`, componentes y accesibilidad en `tests/components/`
  (pragma `// @vitest-environment jsdom`), BD en `tests/db/`. Los proyectos ficticios
  para probar validadores están en `tests/_fixtures/`.
- Sin stack levantado, los tests de BD **se saltan con un aviso** en local. En CI fallan.
- Playwright lee las claves del stack con `supabase status` y las inyecta solo en el
  servidor de pruebas (puerto 3100). No toca `.env.local`. Si ya hay un servidor en ese
  puerto, en local lo reutiliza.

## Añadir una variable de entorno

1. **Decide si es pública o secreta.** Pública = puede leerla cualquiera en el navegador
   → prefijo `NEXT_PUBLIC_`. Secreta (claves de API, tokens) → **sin** prefijo, y solo se
   lee en código de servidor (Server Components, Server Actions, route handlers).
2. **Decláralo en el código:**
   - **Pública** → añádela al esquema Zod de [`src/lib/env.ts`](../src/lib/env.ts) y léela
     con `publicEnv()`. Escríbela literal (`process.env.NEXT_PUBLIC_X`): Next solo
     incrusta en el bundle las que aparecen así.
   - **Secreta** → léela en el módulo de servidor que la usa, validándola con Zod donde se
     lea por primera vez. Si hay varias, crea un `serverEnv()` en `src/lib/env.server.ts`
     con `import "server-only"` (paquete `server-only`): así un import desde el cliente
     rompe el build en vez de filtrar el secreto.
   - **Opcional** (la app funciona sin ella, como `NEXT_PUBLIC_SENTRY_DSN`) → sin esquema
     obligatorio; el código comprueba si existe.
3. **[`.env.example`](../.env.example)**: añádela en su bloque, con un comentario que diga
   de dónde sale el valor y si es secreta. Nunca con un valor real.
4. **Documéntala** en la tabla de variables de [DEPLOYMENT.md](DEPLOYMENT.md) (columna
   «¿Secreta?»). Si la añade un módulo, también en su README.
5. **Vercel** → Project Settings → Environment Variables, en *Production* y *Preview*
   (y *Development* si se usa `vercel env pull`). Las `NEXT_PUBLIC_*` se fijan en el
   **build**: tras cambiarlas hay que redesplegar.
6. **Comprueba que un secreto no se ha filtrado:**
   ```bash
   npm run build
   grep -rl "<un fragmento del valor secreto>" .next/static || echo "no está en el bundle"
   git grep -n "<un fragmento del valor secreto>" || echo "no está en el repo"
   ```
   Si aparece, retíralo y **rota el secreto**: dejarlo fuera del código no lo retira de
   la historia de git ni de los bundles ya desplegados.

## Ramas y CI

- `main` es producción: cada push despliega en Vercel.
- **Ramas largas de desarrollo**: CI y E2E corren en `main`, en todo PR y en las ramas
  listadas en `on.push.branches` de [`ci.yml`](../.github/workflows/ci.yml) y
  [`e2e.yml`](../.github/workflows/e2e.yml). Por defecto, `develop` y `long/**`. Si el
  proyecto trabaja con otra rama larga (p. ej. `testing`), se añade en los dos ficheros.
  Motivo: [ARCHITECTURE.md §11](ARCHITECTURE.md).
- Commits: Conventional Commits en inglés técnico ([`CLAUDE.md`](../CLAUDE.md) §2).

## Servidores MCP (opcional)

El repo no incluye `.mcp.json`: es configuración de cada máquina. Ejemplo para crearlo
localmente (o en la configuración de usuario de Claude Code):

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<REF_DEL_PROYECTO>&read_only=true"
    },
    "vercel": { "type": "http", "url": "https://mcp.vercel.com" },
    "sentry": { "type": "http", "url": "https://mcp.sentry.dev/mcp/<ORGANIZACION>" }
  }
}
```

Contra producción, siempre `read_only=true`. Ningún script, test ni despliegue depende de
MCP.

## Previsto en Excelsior

- **Stripe en local** (Fase 4): Stripe CLI para reenviar webhooks al servidor local
  (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), con claves de modo
  test. Nunca claves live en `.env.local`.
- **Google en local**: crea un cliente OAuth «Aplicación web» en Google Cloud con la URI
  de redirección `http://127.0.0.1:55421/auth/v1/callback`. Después:
  1. `export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…` y
     `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…` en la shell (nunca en un fichero del repo);
  2. `enabled = true` en `[auth.external.google]` de `supabase/config.toml` (sin
     commitearlo mientras no haya credenciales en CI);
  3. `NEXT_PUBLIC_AUTH_GOOGLE=true` en `.env.local`;
  4. `npm run db:stop && npm run db:start`: **la configuración de Auth (también el hook)
     solo se lee al arrancar el stack**, `db:reset` no basta.
- **Emails en local**: siguen yendo a Mailpit; Resend solo en los entornos desplegados.
- **Probar en móvil**: `npm run dev -- --hostname 0.0.0.0` y abrir la IP de la máquina
  desde el teléfono en la misma red (en WSL puede requerir reenviar el puerto).

## Problemas frecuentes

- **«El Supabase local no está levantado»** — `npm run db:start`.
- **Puerto ocupado al arrancar Supabase** — otro proyecto usa el mismo rango. Cambia los
  puertos en `supabase/config.toml` (todo lo demás los lee de ahí).
- **Tests de BD saltados** con el stack levantado — ¿migraciones sin aplicar?
  `npm run db:reset`.
- **`db:drift` falla tras una migración** — `npm run db:pull` y commitea el schema junto
  a la migración.
- **`db:types:check` falla** — la migración nueva vino sin sus tipos:
  `npm run db:types` y commitea `src/lib/database.types.ts` junto a ella.
- **Tras un E2E no puedo entrar con `dev@`** — el E2E resetea la base: `npm run seed:dev`
  (y `npm run dev:staff -- dev@example.test admin` para volver a ver el panel).
- **Playwright dice «Executable doesn't exist»** tras actualizarlo — falta su navegador:
  `npx playwright install chromium`.
- **El código del email para firmar** — en local llega a Mailpit
  (<http://127.0.0.1:55424>). Los E2E lo leen con su API (`e2e/support/correo.mjs`).
- **Cambié `supabase/config.toml` (Auth, plantillas, límites) y no se nota** — la
  configuración de Auth solo se lee al arrancar: `npm run db:stop && npm run db:start`.
- **Para ver el panel de R3ZON en local** — `npm run dev:staff -- dev@example.test admin`
  y recarga. Los E2E usan además `admin-e2e@r3zon.test` (lo crea `seed:e2e`).
- **`docs:validar` dice que la identidad no coincide** — un fichero que repite datos de
  `src/config/project.ts` se quedó sin actualizar; el mensaje dice cuál
  ([TEMPLATE.md](TEMPLATE.md) → Personalizar la identidad).
- **npm avisa de «install scripts not covered by allowScripts»**, o `db:drift` falla
  diciendo que no encuentra el motor tras actualizar Prisma — procedimiento completo en
  [STACK.md](STACK.md) → `allowScripts`.
- **`next dev` añade `.next/dev/types/**/*.ts` al `tsconfig.json`** — es Next quien lo
  escribe; el typecheck usa `tsconfig.typecheck.json` y no le afecta.
