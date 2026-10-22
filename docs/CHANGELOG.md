# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

> **Esta es la bitácora de la plantilla.** Un proyecto creado desde ella la vacía y
> empieza con «Iteración 1 — Proyecto creado desde R3ZON Template vX.Y.Z»
> ([TEMPLATE.md](TEMPLATE.md) → Documentación al derivar). La historia del core sigue
> aquí, en el repo de la plantilla.

---

### Iteración 2 — *2026-09-26* — Cierre de la v1.0: personalización comprobable y versionado

Segunda pasada tras la auditoría final (`docs/auditoria-template-final.md`). Objetivo:
que un proyecto creado con *Use this template* y personalizado según la documentación
nazca en verde, que la personalización se compruebe sola, y que la plantilla tenga
versión y un camino para llevar sus mejoras a los proyectos derivados. Sin
funcionalidad nueva.

**Bloqueante resuelto**

- **B1.** `tests/public-docs.test.ts` copiaba el repo y sustituía el dominio de la
  plantilla. En cuanto un proyecto ponía el suyo, el test no encontraba el texto, el
  validador no veía error y CI se ponía en rojo. Ahora los casos parten de un proyecto
  ficticio autocontenido (`tests/_fixtures/proyecto.ts`), y `editar()` falla si el texto
  a sustituir no existe: un fixture que ya no encaja no puede volver a dar un falso
  verde. Se añadió además un caso positivo de redirect, para que el negativo pruebe
  algo.

**Personalización honesta (I4)**

- `docs:validar` compara la identidad de `project.ts` con `package.json`, `config.toml`,
  `entidad.json`, `rutas-app.json` y el título de `index.md` (nueva
  `scripts/lib/identidad.mjs`). El script **importa `project.ts` directamente**: Node 24
  ejecuta TypeScript sin compilar, así que no hay una segunda copia de los valores ni
  expresiones regulares sobre el código. Se descartó leer el fichero con regex (Biome
  parte en dos líneas las descripciones largas) y moverlo a un JSON (cambia el punto
  único que ya conocía todo el mundo).
- `slug` y `organization` dejan de ser decorativos:
  - `slug` es el nombre que se exige en `package.json`, en `project_id` y en la ruta de
    la documentación;
  - `organization` va a los metadatos (`publisher`, `creator`) y a `entidad.json`;
  - `locale` también llega a `og:locale`.

  Cada campo documenta dónde se usa.
- `homePath` es honesto: los E2E y los tests unitarios leen el valor; un test falla si no
  existe su página, y el comentario dice que cambiarlo exige renombrar la carpeta.
  Probado cambiándolo a `/panel` en un proyecto ficticio.
- `site_url` de Supabase pasa a `http://localhost:3000`, el mismo origen que usa la app,
  y un test lo vigila.
- `tests/unit/project.test.ts` falla si un proyecto derivado conserva los puertos
  reservados por la plantilla (55321, 55322) o su auditoría final.

**Versionado (I3)**

- `r3zon-template.json` declara la versión del core (`1.0.0`) y lo que la plantilla
  reserva. `package.json` sigue siendo la versión del producto, y su `name` pasa a ser el
  slug (`r3zon-template`).
- `docs/TEMPLATE.md` reúne:
  - semver de la plantilla;
  - cómo crear un proyecto (la tabla de personalización sale del README);
  - qué hacer con cada documento al derivar;
  - `public_docs/` en apps internas;
  - cómo incorporar una versión nueva (`git remote add plantilla` + `git diff vA vB |
    git apply --3way` o `cherry-pick -x`, renombrando las migraciones del core).
- Se descartó un sistema de sincronización automático y los submódulos: la copia manual
  revisada es suficiente, y cada proyecto decide cuándo adopta.

**Resto**

- **I2:** `npm run db:types:check` en CI compara los tipos regenerados con los versionados
  (sin escribir). Se prefirió a `git diff --exit-code` porque funciona igual en local con
  cambios sin commitear.
- **I5:** tabla de documentos al derivar en `TEMPLATE.md`. Nada enlaza
  `auditoria-template-final.md`, para que borrarlo no rompa `docs:enlaces`.
- **I6:** procedimiento de `allowScripts` en `STACK.md` y regla en `CLAUDE.md` §11 bis.
- **I7:** la recuperación de contraseña queda en `auth-advanced` en v1.0, con su motivo.
- **I8:**
  - `CLAUDE.md` describe exactamente lo que comprueba el test de catálogo y tiene un
    bloque de comandos;
  - `STACK.md` explica las dependencias en una tabla vigilada por un test (sin un número
    escrito a mano que se quede viejo);
  - vocabulario neutro en `ROLES.md` y `modules/README.md`, incluido `tiene_permiso` →
    `has_permission`;
  - redirect de ejemplo sin `/ayuda`;
  - cómo añadir una variable de entorno en `DEVELOPMENT.md`.
- **I9:** documentado que `test:e2e` resetea la base local y cómo recuperar el usuario.
- **Catálogo:**
  - entra `i18n`;
  - `charts` y `analytics` pasan a recetas;
  - móvil y escritorio comparten la decisión cliente/servidor, con URL remota como
    recomendación.
- **Seguridad:**
  - HSTS sin `preload` (es un compromiso del dominio);
  - `.claude/settings.json` bloquea `cat`, `head`, `tail`, `less`, `more` y `bat` sobre
    `.env*` y pide confirmación para `git tag`.
- Fuera `@vitejs/plugin-react` (comprobado innecesario). Nuevo script `test:db`.
- `DEPLOYMENT.md`: «¿Qué hago cuando algo falla en producción?».

**Congelado para v1.0:** Node 24, Prisma 7 (en el core), CLI de Supabase, `overrides`,
Sentry y Speed Insights.

**Errores propios del camino**

- Un primer intento de reescribir el spec E2E con un heredoc de Python desde Git Bash se
  quedó colgado (el `python3` de Windows esperando entrada). Se reescribió el fichero
  entero.
- El fixture con `as const` hacía que los tests de identidad no compilaran (los campos
  eran literales). Se tipó como `Record<…, string>`.

### Iteración 1 — *2026-09-23* — Creación de la plantilla de proyectos SaaS de R3ZON

Se crea el repositorio como plantilla oficial de proyectos SaaS de R3ZON, destilando la
experiencia de R3ZON ANTARES (su documento `PLANTILLA_PROYECTO_NUEVO.md` y el propio
código) sin depender de él. Antes de escribir nada se clasificó cada decisión de ANTARES
en core, módulo opcional, específica de ANTARES o pendiente de revisión, y esa
clasificación se aprobó (decisiones R1–R13). La pregunta guía fue: ¿esto facilita que
R3ZON cree cinco SaaS distintos trabajando igual?

**Core construido**

- Next.js 16 (App Router, `proxy.ts`), TypeScript 7 estricto, Tailwind 4 con tokens RGB
  en `:root`, Zod 4, lucide-react, Biome 2.
- `src/config/project.ts` como único punto con la identidad del producto (valores neutros).
- Auth mínima: sesión en el proxy, lista explícita de rutas públicas, login con email y
  contraseña (Server Action), callback (PKCE y `token_hash`), logout solo por POST,
  segunda comprobación en el layout de `(app)`, `safeRedirectPath` para toda redirección
  que llega de fuera.
- Base de datos: una migración con `public.profiles` (1:1 con `auth.users`, trigger de
  alta, RLS de fila propia, grants por columna, CHECK, cascada), `set_updated_at()`
  reutilizable y default privileges que retiran `EXECUTE` a `PUBLIC`/`anon`.
- Prisma 7 solo como CLI, detrás de `scripts/prisma-db.mjs` (solo base local; introspección
  `public`+`auth` filtrada a `public`; drift con código de salida propio).
- Tests: 78 en Vitest (unitarios, componentes, jest-axe, BD real con RLS y catálogo,
  validador de docs) y 8 E2E en Playwright contra el build de producción.
- CI: `ci.yml` (install → lint → typecheck → Supabase → drift → tests → docs → build),
  `e2e.yml`, `security.yml` (`npm audit` + vigencia de overrides). Discord opcional.
- Observabilidad: Sentry sin DSN en código, apagado sin DSN y sin datos personales;
  Speed Insights; logger JSON con redacción; `/api/health`.
- `public_docs/` con el contrato universal, `_meta/`, dos páginas reales y validador.
- `docs/` completo, `CLAUDE.md`, `modules/README.md` con contrato y catálogo (16
  candidatos, ninguno implementado).

**Verificación de `public_docs/` contra el consumidor real.** Se compiló el build de
`R3ZON-Docusaurus` en una copia desechable, con este `public_docs/` copiado tal cual y el
producto registrado: compila, emite `HowTo` con `dateModified` sacado de
`last_update.date` y genera los `llms*.txt`. Sin tocar un solo Markdown. Destapó dos
supuestos del Docusaurus heredados de su primer producto, anotados en `mejoras.md`.

**Decisiones tomadas durante la implementación** (menores, sin consulta)

- **Puertos propios del stack local (5532x) leídos de `config.toml`.** El Supabase de otro
  proyecto ocupaba los puertos por defecto en la máquina de desarrollo; con puertos
  compartidos, los tests de BD pueden acabar hablando con la base equivocada. Scripts,
  tests y Playwright leen el puerto del único sitio donde está.
- **Supabase CLI como devDependency**, no `npx supabase@latest`: la versión queda en el
  lockfile y es la misma en todas partes.
- **Prisma 7.10, no 8**: `latest` en npm apuntaba a una release candidate.
- **TypeScript 7**: el compilador nativo funciona con Next 16.3 (build y typecheck en
  verde). Salida documentada si alguna herramienta lo rechaza: fijar la 6.
- **Dos overrides con motivo**: `mysql2` y `deepmerge-ts`, transitivas de Prisma con avisos
  HIGH. Sin ellos, `security.yml` nacería en rojo.
- **`allowScripts` de npm 11** con los tres paquetes que lo necesitan (Prisma ×2, Sentry
  CLI).
- **Sin `.mcp.json` en el repo**: ejemplo en `docs/DEVELOPMENT.md`. MCP no es requisito
  de nada.
- **`.claude/settings.json`** pide confirmación para `git commit`/`git push` e impide leer
  `.env.local` y lanzar `prisma db push`/`migrate`.
- **Sin página de registro en el core**: el registro público implica decisiones de
  producto (confirmación de email, consentimiento legal) y va con `auth-advanced`.
- **Contrato de `public_docs` universal**: se quitan `r3zon.modulo`, `plan_minimo` y
  `permiso` (sus valores eran de un producto). Los tres grupos de `rutas-app.json` se
  mantienen, aunque `modulos` quede vacío, porque el Docusaurus los lee siempre. Una sola
  fecha por página (la del frontmatter): se descarta el pie con fecha duplicada.
- **Margen de un día en «fecha no futura»**: las fechas se escriben a mano en hora de
  España y CI corre en UTC.
- **Sentry cargado con `import()` en el navegador** (solo con DSN), sin búfer de errores
  tempranos: ver `mejoras.md`.

**Descartado y por qué**

- Workflows que tocan producción (migraciones, drift de producción, backups): necesitan
  secretos y decisiones de cada proyecto. Documentados en `mejoras.md` y el módulo `backups`.
- CSP: depende de los terceros de cada producto (`auditoria.md` A1-2).
- Vercel Analytics en el core: es analítica de producto, sujeta a consentimiento; módulo
  `analytics`.
- Cualquier sistema de plugins, CLI, monorepo o generador: no hacen falta todavía.
- `novedades.ts`: la regla de anunciar cambios va a `CLAUDE.md`; la implementación, al
  módulo `whats-new`.

**Errores propios del camino**

- **Los default privileges no hacían nada.** La primera versión de la migración revocaba
  el `EXECUTE` con `alter default privileges in schema public …`. En PostgreSQL, los
  privilegios por esquema solo pueden AÑADIR sobre los globales, y el `EXECUTE` a `PUBLIC`
  es global: `anon` seguía ejecutando toda función nueva. Lo cazó el test de sonda del
  catálogo antes de que existiera ninguna RPC. Corregido con una revocación global
  `for role postgres`; la migración aún no se había aplicado en ningún entorno compartido
  (auditoria.md A1-1).
- **Un E2E fallaba por el propio test**: Next.js monta su anunciador de rutas con
  `role="alert"`, y `getByRole("alert")` encontraba dos. Se filtra por texto.
- **El validador marcó como futuras las fechas de hoy**: eran las 23:56 UTC y en España ya
  era el día siguiente. De ahí el margen de un día.
