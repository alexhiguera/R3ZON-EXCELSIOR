# Auditoría final de la plantilla R3ZON

*2026-09-26* · Auditoría previa a declarar la plantilla estable (v1.0) para
*Use this template*. **No se ha modificado ningún fichero del repositorio** salvo la
creación de este informe. Las pruebas se hicieron en copias desechables fuera del repo.

---

## 1. Objetivo

Responder a una pregunta: **¿esta plantilla está preparada para crear proyectos R3ZON
nuevos de forma repetible, limpia y sin arrastrar decisiones específicas de ANTARES?**

Qué se hizo, además de leer el repositorio completo:

| Prueba | Cómo | Resultado |
|---|---|---|
| Simulación de *Use this template* | Copia de solo los ficheros versionables (111), `git init` nuevo, sin `.next`, `next-env.d.ts`, `.env.local` ni `node_modules` | Ver §5 |
| Orden de CI sin artefactos locales | `npm ci` → lint → typecheck → `db:validate` en la copia limpia | ✅ todo en verde (el typecheck no depende de `next-env.d.ts`) |
| Personalización siguiendo el README | Cambiar `project.ts`, `package.json`, `config.toml` (puertos 5542x) y `_meta/` a un producto ficticio «Acme Portal» | ✅ salvo **un test que falla** (§15, B1) |
| Arranque completo | `dev:setup` → drift → tests con `CI=true` → build → E2E → servir y pedir `/`, `sitemap.xml`, `robots.txt` | ✅ con dos hallazgos (§5) |
| Dos stacks en paralelo | El stack de la copia (5542x) levantado a la vez que el de la plantilla (5532x) | ✅ conviven |
| Dependencia prescindible | Tests de componentes sin `@vitejs/plugin-react` (en la copia) | ✅ pasan igual |
| Residuos de ANTARES | Búsqueda de nombres, entidades, rutas, vocabulario, IDs, dominios y comentarios | Ver §14 |
| `public_docs` → Docusaurus | Revisión de qué campos lee de verdad `R3ZON-Docusaurus` y qué publica (build real hecho en la iteración 1) | Ver §8 |
| Workflows | Parseo del YAML, revisión de triggers, secretos y permisos | Ver §9. **No se han ejecutado en GitHub** |
| Política de npm `allowScripts` | Lectura de la documentación de npm 11.19 instalada | Ver §11 |

## 2. Estado general

**Veredicto: la plantilla ya sirve para empezar proyectos reales**, con **un bloqueante
de una línea** (un test que se pone en rojo al personalizar) y un puñado de ajustes
importantes pero pequeños antes de etiquetar la v1.0.

Lo que funciona de verdad, comprobado en una copia limpia:

- Un repositorio nuevo arranca desde cero con `npm ci` + `npm run dev:setup` sin pasos
  ocultos: migraciones, `.env.local`, usuario de desarrollo, login y `/inicio` con datos
  leídos a través de la RLS.
- El nombre del proyecto llega a la app cambiando solo `project.ts` (`<title>Acme
  Portal</title>`).
- Lint, typecheck, drift, 78 tests (con `CI=true`), build y 8 E2E en verde en la copia.
- No hay dependencias funcionales de ANTARES: ni código, ni tablas, ni rutas, ni
  variables, ni IDs, ni dominios.
- `public_docs/` cumple un contrato universal y el Docusaurus real lo consume sin tocar
  un Markdown.

Lo que falta es sobre todo **mantenimiento a largo plazo**: cómo evoluciona la plantilla
y cómo reciben sus mejoras los proyectos derivados (I3), y que la personalización se
pueda comprobar de forma automática (I4).

## 3. Core vs módulos

| Componente | Core | Módulo | Producto | Revisar | Motivo |
|---|:-:|:-:|:-:|:-:|---|
| Next.js 16 (App Router, `proxy.ts`) | ✅ | | | | Base común a todos los productos |
| TypeScript estricto | ✅ | | | | |
| Tailwind 4 + tokens de tema | ✅ | | | | La paleta es de producto; el mecanismo, común |
| lucide-react, `clsx` + `tailwind-merge` | ✅ | | | | Ligeros y usados por la UI base |
| Zod | ✅ | | | | Env, formularios, entrada de datos |
| Supabase (Postgres, Auth, RLS) | ✅ | | | | Estándar de datos y seguridad de R3ZON |
| `public.profiles` | ✅ | | | | Infraestructura 1:1 con `auth.users`, sin negocio |
| Auth: sesión, login, callback, logout, gate | ✅ | | | | Todo producto con panel lo necesita |
| Recuperar contraseña | | ✅ | | ⚠️ | Hoy en `auth-advanced`. Casi todo producto con contraseña la necesita (I7) |
| Registro público, OAuth, 2FA, onboarding | | ✅ | | | Dependen del producto (una app interna no tiene registro público) |
| Prisma (introspección, Studio, drift) | ✅ | | | ⚠️ | Pedido expresamente, pero es la pieza con peor coste/beneficio (§13) |
| Biome | ✅ | | | | |
| Vitest + Testing Library + jest-axe | ✅ | | | | |
| Tests de BD (RLS, catálogo de seguridad) | ✅ | | | | La pieza más valiosa del core |
| Playwright | ✅ | | | | |
| GitHub Actions: `ci`, `e2e`, `security` | ✅ | | | | Reutilizables; ramas largas configurables |
| Notificación a Discord | ✅ opcional | | | | Se desactiva sola sin secreto |
| Sentry | ✅ | | | | Apagado sin DSN; sin datos personales |
| Speed Insights | ✅ | | | | Sin cookies; cada producto decide si va tras el consentimiento |
| Vercel Analytics | | ✅ `analytics` | | | Analítica de comportamiento, sujeta a consentimiento |
| `/api/health` | ✅ | | | | |
| Logger con redacción | ✅ | | | | |
| Cabeceras de seguridad básicas | ✅ | | | | |
| CSP | | | ✅ | | Depende de los terceros de cada producto |
| `public_docs/` + validador | ✅ | | | | Obligatorio por decisión R6 |
| R3ZON-Docusaurus | | | | | Repositorio aparte; el core solo cumple su contrato |
| `llms.txt` de la app | | | ✅ | | Opcional por producto (§8) |
| Backups | | ✅ `backups` | | | Depende del plan de Supabase, pero **obligatorio antes de producción** |
| Workflows de producción (migraciones, drift remoto) | | ✅ / doc | | | Necesitan secretos y decisiones por proyecto |
| MCP | | | | | Configuración de cada máquina; ejemplo documentado |
| `CLAUDE.md` + `.claude/settings.json` | ✅ | | | | |
| graphify | | | | | Herramienta opcional de máquina, documentada |
| i18n | | ✅ (futuro) | | ⚠️ | No está en el catálogo, aunque R3ZON-web ya usa `next-intl` (§5) |
| Roles y permisos | | ✅ | | | Solo el modelo (3 dimensiones) es core, como documento |
| Multi-tenancy | | ✅ | | | Solo los principios son core |
| Stripe | | ✅ `billing-stripe` | | | |
| Resend | | ✅ `email-resend` | | | Supabase ya envía los correos de Auth sin él |
| Legal y consentimiento | | ✅ | | | Un producto público en la UE casi siempre lo necesitará |
| Charts | | ⚠️ | | ⚠️ | Demasiado fino para ser módulo: basta una receta (§7) |
| Capacitor / Electron | | ✅ | | ⚠️ | Choca con la auth del core basada en servidor (§5, proyecto E) |

## 4. Reutilización

**Datos de producto en el core: ninguno funcional.** La búsqueda de facturación,
clientes, productos, pedidos, suscripciones, planes, empresas, multiempresa, roles,
permisos, moneda, impuestos, países y sectores solo encuentra:

- el **vocabulario de arquitectura** («reglas de negocio», «cliente de Supabase»), que
  es genérico;
- el catálogo de módulos y los documentos que describen el futuro (`ROLES.md`,
  `ARCHITECTURE.md` §5), que hablan de tenants, planes y permisos **como modelo**, sin
  crear nada;
- **ejemplos con vocabulario de ANTARES** en `docs/ROLES.md` (ver §14).

**Suposiciones que sí quedan, todas aceptables por decisión previa:**

| Suposición | Dónde | Valoración |
|---|---|---|
| Idioma español en la UI | Textos de login, errores, `/inicio`, `public_docs/` | Aceptado (R13): sin i18n. Pero `project.locale` solo cambia `<html lang>` y metadatos: **no traduce nada**, y conviene decirlo junto al campo (I4) |
| Ruta `/inicio` en español | Carpeta `src/app/(app)/inicio`, `homePath`, 14 apariciones en tests, E2E y `_meta` | `homePath` **aparenta ser configurable y no lo es** (I4) |
| Región UE (`fra1`, Supabase en UE) | `vercel.json`, `DEPLOYMENT.md` | Aceptado: es la política de R3ZON |
| Zona horaria de España | Margen de un día del validador de `public_docs` | Aceptado: margen inocuo |
| Organización R3ZON | `entidad.json`, textos | Correcto: todos los productos son de R3ZON |

## 5. Portabilidad

| Necesidad | A · SaaS B2B | B · Web corporativa + panel | C · App interna | D · SaaS Stripe + multi-tenant | E · Con Electron después |
|---|:-:|:-:|:-:|:-:|:-:|
| Core tal cual | ✅ | ✅ (algo pesado) | ✅ | ✅ | ⚠️ |
| `auth-advanced` | Registro + recuperación | Recuperación | OAuth/SSO de la empresa | Registro + recuperación | Según producto |
| `multi-tenancy` + `roles-permissions` | Probable | No | Solo roles | ✅ | Según producto |
| `billing-stripe` | Probable | No | No | ✅ | Según producto |
| `email-resend` | ✅ | Formulario de contacto | Opcional | ✅ | Según producto |
| `legal-consent` | ✅ | ✅ | No | ✅ | Según producto |
| `backups` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public_docs` publicado | ✅ | Opcional | **No** (no se registra en el Docusaurus) | ✅ | ✅ |
| i18n | Quizá | **Probable** | No | Quizá | Quizá |
| `desktop-electron` | | | | | ✅ |

Conclusiones:

- **El core encaja en los cinco.** Nada de él presupone un modelo de negocio.
- **B (web corporativa)** carga con Sentry, Prisma, Playwright y Supabase para un panel
  sencillo. Es asumible, pero es el caso donde más pesa Prisma (§13). Además cada página
  de marketing debe añadirse a `public-paths.ts` y, si se indexa, a `sitemap.ts`, lo que
  es correcto aunque algo repetitivo. La propia web de R3ZON usa `next-intl`: indicio de
  que **i18n debería entrar en el catálogo de módulos**.
- **C (app interna)**: `public_docs/` es obligatorio, pero publicarlo no. Basta con no
  darlo de alta en el Docusaurus. Conviene escribirlo, porque «documentación pública»
  en una app interna confunde (I4/I5).
- **E (Electron)**: la auth del core usa Server Actions, route handlers y cookies de
  servidor. Eso **no funciona en un bundle estático** (`output: export`), que es como lo
  resolvió ANTARES con un script que apartaba ficheros del build. No es un defecto del
  core, pero el módulo `desktop-electron` tendrá que elegir entre ser una **ventana sobre
  la URL remota** (compatible con el core, sin tocar nada) o un **bundle estático** (auth
  en cliente, incompatible). Conviene anotar esa decisión en el catálogo.

## 6. Configuración

**`src/config/project.ts` centraliza lo que usa el código de la app**, y funciona: el
nombre llega a `<title>` y el idioma a `<html lang>`. Pero la identidad también vive en
ficheros que no pueden importar TypeScript:

| Valor | Dónde se repite | ¿Inevitable? | ¿Validado? |
|---|---|---|---|
| Dominio | `project.ts`, `entidad.json` (×6), `rutas-app.json` (`base`) | Sí: el Docusaurus lee JSON estático | ✅ `docs:validar` compara `project.ts` ↔ `sitioProducto` y `base` |
| Nombre | `project.ts`, `package.json` (distinto formato), `entidad.json`, `public_docs/index.md` (×3) | Sí en `_meta` e `index.md` | ❌ La simulación dejó «R3ZON Template» en `index.md` y el validador pasó |
| Slug | `package.json`, `config.toml` (`project_id`), `sitioDocumentacion` en `entidad.json`, id en el Docusaurus | Sí | ❌ Y **`project.slug` no lo usa ningún código** |
| Descripción | `project.ts`, `entidad.json` | Sí | ❌ |
| Idioma | `project.ts`, `entidad.json` (`inLanguage`) | Sí | ❌ |
| Organización | `project.ts`, `entidad.json` | Sí | ❌ Y **`project.organization` no lo usa ningún código** |
| Ruta de inicio | `project.ts` (`homePath`), nombre de carpeta, tests, E2E, `rutas-app.json` | La carpeta, sí | ⚠️ Cambiar `homePath` sin mover la carpeta rompe el login |
| Puertos del stack local | Solo `config.toml` | — | Bien centralizado (scripts, tests y Playwright lo leen de ahí). **Nada avisa si un proyecto nuevo se queda con 5532x**, el rango de la plantilla |
| URL local | `config.toml` `site_url = 127.0.0.1:3000`, `.env.example` `localhost:3000` | No | Incoherencia menor: los enlaces de email en local llevan a otro origen que el que usa quien desarrolla, y las cookies no se comparten |
| URL pública | `NEXT_PUBLIC_SITE_URL` o `project.domain` | — | Se **fija en el build** (`robots` y `sitemap` son estáticos). En la simulación, el build de E2E dejó `http://localhost:3100` en el sitemap servido después |

La duplicación en `_meta/` es inevitable por el contrato con el Docusaurus. **Lo evitable
es que no se compruebe.** Ver I4.

La tabla «Crear un proyecto nuevo» del README es completa: el `grep` que sugiere
encontró exactamente los ficheros pendientes. Tiene dos efectos secundarios:

- lista también `tests/public-docs.test.ts`, que no hay que tocar (y además es el que
  falla, B1);
- lista `README.md` y `project.ts` por el propio comando y por el comentario sobre
  `example.com`, y eso añade ruido.

## 7. Developer Experience

| Pregunta de alguien nuevo | ¿Se responde? | Dónde / hueco |
|---|---|---|
| 1. Dónde modificar la configuración | ✅ | README «Crear un proyecto nuevo», `project.ts` |
| 2. Dónde crear una página | ✅ | `STRUCTURE.md` «Dónde va cada cosa»; `AUTH.md` para las públicas |
| 3. Dónde crear un componente | ✅ | `STRUCTURE.md` |
| 4. Dónde poner lógica de negocio | ✅ | `STRUCTURE.md` (`src/lib/<dominio>.ts`) |
| 5-6. Tablas y migraciones | ✅ | `DATABASE.md` «Flujo al cambiar el esquema», `CLAUDE.md` §4 |
| 7. Trabajar con Supabase | ✅ | `DEVELOPMENT.md`, `DATABASE.md`, `AUTH.md` |
| 8. Usar Prisma | ✅ | `DATABASE.md` |
| 9. Dónde poner tests | ✅ | `STRUCTURE.md`, `DEVELOPMENT.md` |
| 10. Ejecutar E2E | ⚠️ | Documentado, pero **no avisa de que `test:e2e` resetea la base local**: se pierden los datos de desarrollo y el usuario `dev@` hasta repetir `seed:dev` (I9) |
| 11. Añadir un módulo | ✅ | `modules/README.md` (contrato) |
| 12. Documentar el producto | ✅ | `CLAUDE.md` §7-9, `public_docs/CONVENCIONES.md` |
| 13. Publicar documentación | ✅ | `public_docs/README.md` §3 |
| 14. Desplegar | ✅ | `DEPLOYMENT.md` |
| 15. Revisar errores | ⚠️ | Sentry y los logs de Vercel se explican, pero no hay un apartado «dónde miro cuando algo falla en producción» |
| 16. Añadir una variable de entorno | ❌ | **No documentado.** Serían cuatro sitios: `env.ts` (si es pública), `.env.example`, la tabla de `DEPLOYMENT.md` y Vercel. Tampoco hay esquema Zod para las variables de servidor |

Otros roces:

- Hay dos carpetas con nombre casi igual, `src/app/(auth)/` (páginas) y `src/app/auth/`
  (route handlers). Está explicado en `STRUCTURE.md`, pero confunde a primera vista.
- `playwright.config.ts` ejecuta `supabase status` al importarse, así que cualquier uso
  de Playwright (incluso `--list`) exige el stack levantado. Da un error claro; se acepta.

## 8. Public Docs

| Requisito | Estado |
|---|---|
| Sin conceptos de ANTARES | ✅ `modulo`, `plan_minimo` y `permiso` retirados; el validador los rechaza |
| No presupone planes, módulos ni estructura de negocio | ✅ con un matiz: la clave `modulos` de `rutas-app.json` conserva ese nombre porque el Docusaurus la lee siempre. Queda vacía y es neutra |
| Contrato claro | ✅ `public_docs/README.md` separa qué hace cada repositorio, los campos, las fechas y los enlaces |
| Consumible por el Docusaurus | ✅ build real en la iteración 1: JSON-LD en 2/2 páginas, sin editar Markdown |
| Validación | ✅ `docs:validar` en CI + 15 tests con fixtures |
| Información privada | ✅ `README.md` y `CONVENCIONES.md` se sincronizan al repo del Docusaurus (privado) pero no se publican (`DEFAULT_DOC_EXCLUDES`). `_meta/` no se publica (`**/_*/**`). `r3zon.origen` (ruta de código) lo lee el Docusaurus pero **no lo emite** |

**`llms.txt` / `llms-full.txt` — dónde se resuelve.** El Docusaurus imprime
`Plan mínimo: Free` en cada página aunque el producto no tenga planes, y enlaza una
«Ficha del producto» en `https://<app>/llms.txt` que la app no sirve.

- **No pertenece a la plantilla.** El contrato de la plantilla es correcto: no hay plan
  que declarar.
- **Pertenece a R3ZON-Docusaurus**: imprimir el plan solo si existe `plan_minimo`, y
  enlazar el `llms.txt` de la app solo si el producto lo declara (por ejemplo, un campo
  en `config/products.ts`).
- **Por proyecto, opcional**: un producto que quiera una ficha para modelos de lenguaje
  la sirve en su app. El proxy ya deja pasar `.txt` sin sesión.
- **Hasta entonces: documentado** (`docs/mejoras.md`). No bloquea: el sitio se publica
  bien y el dato erróneo solo aparece en `llms-full.txt`.

## 9. CI/CD

| Aspecto | Valoración |
|---|---|
| Triggers | ✅ Todo PR + push a `main`, `develop` y `long/**`. Nada de `testing` ni ramas de ANTARES |
| Pasos | ✅ install → lint → typecheck → validate → Supabase → drift → tests → docs → build |
| Tests de BD | ✅ Con `CI=true` fallan si no hay base (comprobado) |
| Secretos | ✅ Solo `DISCORD_WEBHOOK`, opcional. El build no necesita ninguno |
| Permisos | ✅ `contents: read` en los tres workflows |
| Inyección | ✅ La notificación no interpola el mensaje de commit |
| **Ejecución real en GitHub** | ❌ **Nunca ha corrido.** Todo está reproducido en local, pero no en un runner (I1) |
| Versiones de las actions | ⚠️ `checkout@v4`, `setup-node@v4` y `upload-artifact@v4`, fijadas por etiqueta. Hay que comprobar si siguen siendo la versión mayor vigente y si su runtime de Node está en retirada en los runners (I1). Fijarlas por SHA es una mejora posterior |
| Tipos de la BD | ❌ **CI no comprueba que `database.types.ts` corresponda a las migraciones.** Una migración sin `db:types` pasa el typecheck con tipos viejos (I2) |
| Coste | ⚠️ `ci.yml` y `e2e.yml` levantan un Supabase completo cada uno en cada PR. `supabase start -x` para excluir Studio, Realtime, Storage e imgproxy lo acortaría (mejora) |
| Discord | Solo notifica `ci.yml`; E2E y Security no. Aceptable |
| Actualización de dependencias | ⚠️ Un bot como Dependabot que suba Prisma o Sentry chocará con `allowScripts` (§11, I6) |

Nada de CI es específico de ANTARES. Lo que ANTARES tenía de más (escritorio, backups,
barrido de webhooks, migraciones a producción) está fuera y documentado.

## 10. Seguridad

**Universal y ya resuelto en el core:**

- `.env*` ignorados salvo `.env.example`; sin secretos en el repo; DSN de Sentry solo por
  variable.
- RLS en todo, permisos mínimos, default privileges sin `EXECUTE` a `PUBLIC`/`anon`, y
  test de catálogo para toda tabla futura.
- `service_role` fuera de la app. Scripts de siembra y Prisma limitados a la base local
  (por `supabase status` y por comprobación de host).
- Redirecciones seguras, logout solo por POST y mensaje de login que no revela qué emails
  existen.
- Rutas desconocidas → 307, no 404: no se puede enumerar qué rutas existen.
- Logger y Sentry con redacción de secretos; sin `setUser` ni cuerpos de petición.
- Cabeceras: `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- GitHub Actions con permisos de solo lectura.

**Por proyecto (correcto que no esté en el core):** CSP, CORS (el core no expone APIs
entre orígenes), limitación de intentos más allá de la de Supabase, y consentimiento de
Speed Insights.

**Observaciones:**

| Tema | Valoración |
|---|---|
| HSTS con `preload` | ⚠️ `preload` es un compromiso del dominio que no debería decidir la plantilla. Mejor sin él por defecto (mejora) |
| Cookies de sesión | Las de `@supabase/ssr` no son `httpOnly` por diseño (el cliente del navegador las lee): un XSS podría leerlas. Por eso la CSP importa. Aceptado, porque es el diseño de Supabase |
| `.claude/settings.json` | Impide `Read(.env.local)`, pero no `Bash(cat .env.local)`. La regla escrita en `CLAUDE.md` cubre el caso; se puede reforzar (mejora) |
| `/api/health` | Expone el SHA del commit. Riesgo bajo; aceptado |
| APIs | El proxy no protege `/api/*`: cada handler comprueba la sesión. Documentado en `AUTH.md`. Hoy solo existe `/api/health` |
| Scripts destructivos | `db:reset` y `test:e2e` (que lo encadena) solo actúan sobre el stack local; ninguno toca producción |
| `CLAUDE.md` §4 | **Promete más de lo que comprueba el test de catálogo**: dice que falla si faltan «policies por acción» o «tests», y no comprueba ninguna de las dos cosas, ni los grants de `authenticated` (I8) |

## 11. Dependencias

- **Runtime: 11 paquetes**, todos usados: `next`, `react`, `react-dom`, `@supabase/ssr`,
  `@supabase/supabase-js`, `zod`, `lucide-react`, `clsx`, `tailwind-merge`,
  `@sentry/nextjs` y `@vercel/speed-insights`. `STACK.md` dice «nueve» (I8).
- **Ninguna entra solo porque la usara ANTARES.** Quedaron fuera Capacitor, Electron,
  Stripe, Resend, react-email, Recharts, FullCalendar, dnd-kit, jsPDF, tesseract, gsap,
  confetti, xyflow y fflate.

| Dependencia | Valoración |
|---|---|
| `@vitejs/plugin-react` (dev) | **Innecesaria**: los tests de componentes pasan igual sin ella (comprobado en la copia). Mejora |
| `prisma` (dev) | Es la que más arrastra: dos `overrides` (`mysql2`, `deepmerge-ts`), dos entradas de `allowScripts` y un motor que se descarga, todo para `db:pull`, `db:drift` y Studio (§13) |
| `@sentry/nextjs` | Instalación pesada (CLI nativa y OpenTelemetry), aunque en runtime no pesa nada sin DSN. Aceptado como core |
| `supabase` (CLI, dev) | Pesada, pero fija la versión en todas partes. Aceptado. La CLI avisa de versiones nuevas en cada comando: ruido menor |
| `@vitest/coverage-v8` | Solo se usa en `test:coverage`. Ligera; aceptado |
| `yaml`, `pg`, `jsdom`, `@testing-library/*`, `jest-axe` | Necesarias |
| `overrides` | Justificados hoy, y `deps:overrides` los vigila. Correcto |
| **`allowScripts`** | npm 11 **omite en silencio** los scripts de instalación de las versiones no aprobadas, y la aprobación va ligada a una versión exacta. Al subir de versión Prisma, no se descargará el motor y `db:drift` fallará en CI con un error que no apunta a la causa. Está en la sección de problemas de `DEVELOPMENT.md`, pero no en la regla de cómo actualizar dependencias (I6) |
| `engines: node >=24 <25` | Correcto hoy. Habrá que abrirlo cuando Node 26 sea LTS (mejora) |

## 12. Documentación

**Sirve para mantener la plantilla y para arrancar un proyecto.** Es breve (unas 1.900
líneas en total), explica el porqué y los enlaces se validan.

| Tipo | Hallazgo |
|---|---|
| Contradicción | `CLAUDE.md` §4 sobre lo que comprueba el test de catálogo (§10) |
| Dato erróneo | `STACK.md`: «nueve paquetes de runtime» (son 11) |
| Vocabulario heredado | `ROLES.md` usa `clientes:read`, `documentos:write`, «titular», «trabajador» y «trabajador-premium», que son de ANTARES. Hay que sustituirlos por ejemplos neutros (I8) |
| Falta | Cómo añadir una variable de entorno (§7) |
| Falta | **Versionado de la plantilla y cómo llevar sus mejoras a los proyectos derivados** (I3). `MODULES.md` pide anotar «versión de la plantilla», pero la plantilla no tiene versión (`package.json` 0.1.0 es la del producto) ni etiquetas |
| Falta | **Qué hacer con cada documento al derivar** (I5). El README cubre `CHANGELOG` y `TAREAS`, pero no `auditoria.md`, `mejoras.md` ni este informe. `TAREAS_PENDIENTES.md` mezcla una sección «Plantilla» con otra «Al crear un proyecto» |
| Falta | En `CLAUDE.md`, un bloque compacto de **comandos** (hoy están repartidos entre §3 y `DEVELOPMENT.md`) |
| Duplicación aceptable | Reglas de BD en `CLAUDE.md` §4 y `DATABASE.md`, y los orígenes en `ARCHITECTURE.md` y `CLAUDE.md`: una es la regla operativa y la otra la explicación |
| Específico de más | Nada relevante |
| Debería desaparecer | Nada. `ROLES.md` y `RESTAURACION.md` describen sobre todo el futuro, pero son el punto donde cada producto escribirá lo suyo |

## 13. Sobrearquitectura

Pregunta: *si mañana creo una aplicación sencilla, ¿cargo con complejidad que no
necesito?*

| Pieza | Coste | Valor | Veredicto |
|---|---|---|---|
| **Prisma como herramienta** | `scripts/prisma-db.mjs` + `lib` + tests (~350 líneas), 2 overrides, 2 `allowScripts`, `schema.prisma`, `prisma.config.ts` y un motor descargado | Studio duplica el Studio de Supabase que ya se levanta en local (55323). El drift compara las migraciones con un **snapshot** del esquema, y `database.types.ts` ya es otro snapshot. Comparar los tipos regenerados con los versionados (I2) daría casi la misma garantía sin Prisma | **Principal candidato a sobrearquitectura.** No es crítico y lo pediste expresamente. Se recomienda reevaluarlo tras el primer proyecto real, no antes de v1.0 |
| Validador de `public_docs` (~300 líneas) | Mantenimiento | Es el único guardarraíl del contrato con otro repositorio | Justificado. Las reglas de redacción («Respuesta corta», encabezados prohibidos) son estrictas pero baratas |
| Test de catálogo de seguridad | Bajo | Muy alto | Justificado |
| Carga diferida de Sentry y limpieza de eventos | Bajo | Privacidad y peso | Justificado |
| Sistema de módulos | Solo un README | Evita contaminar el core | **Correcto, sin sobrearquitectura**: no hay manifest, CLI ni plugins |
| Catálogo de 16 módulos | Solo documentación | Mapa útil | Algo inflado: `charts` y `analytics` son una dependencia y una receta, no módulos; `mobile-capacitor` y `desktop-electron` comparten base; `public-api-webhooks` es especulativo |
| 15 documentos en `docs/` para una sola tabla | Lectura | Andamiaje de cada producto | Aceptable: lo pediste y cada uno es corto |
| `dev-setup.sh`, `env.ts`, `safe-redirect`, `public-paths` | Bajo | Alto | Justificados |

**No hay sobrearquitectura crítica.** Lo único con un coste claramente superior a su valor
es el andamiaje de Prisma, y es una decisión que se puede revisar sin romper nada.

## 14. Residuos de ANTARES

Búsqueda de: `ANTARES`, TicketBAI/TBAI, Batuz/LROE, NEXUS, Mura, Penpot, facturas, TPV,
fichajes, finanzas, CRM, OCR, Google Calendar, negocio, cliente, proveedor, pedido,
suscripción, plan, Stripe, Resend, empresa, tenant, IVA, impuestos, moneda, España,
sector, dashboard, titular, trabajador, `/ayuda`, `preciosXYZ`, el `project_id` y el
`project_ref` de Supabase de ANTARES y su DSN de Sentry.

**Residuos funcionales: ninguno.** No hay código, tablas, rutas, variables de entorno,
IDs, dominios, seeds, fixtures ni configuración de ANTARES.

| Aparición | Dónde | Clasificación |
|---|---|---|
| «R3ZON ANTARES» como origen | `README.md:116,119`, `docs/ARCHITECTURE.md:4,18,24,39,54,81,99,107,113,120`, `docs/CHANGELOG.md:16-18`, `docs/STACK.md:72` | ✅ Correcta: explica el origen de decisiones |
| «Proyecto de origen» en comentarios | `ci.yml:8-10`, `e2e.yml:5`, `sentry.ts:4`, `safe-redirect.ts:7`, `public-paths.ts:24`, `instrumentation-client.ts:8`, `tsconfig.typecheck.json:7`, migración `core_profiles.sql:22`, `verificar-enlaces-docs.mjs:7`, `tests/db/_db.ts:13`, `CLAUDE.md:44,70,80`, `RESTAURACION.md:47`, `modules/README.md:73` | ✅ Correcta: motivo de la regla, sin nombres ni datos |
| `PLANTILLA_PROYECTO_NUEVO.md` | `docs/CHANGELOG.md:16` | ✅ Correcta: referencia histórica al documento fuente |
| «Una impedía emitir cualquier documento» | `ci.yml:10` | ✅ Correcta (histórica), aunque «emitir documento» es jerga de ANTARES |
| `/preciosXYZ` | `docs/ARCHITECTURE.md:81`, `src/lib/public-paths.ts:24` | ✅ Correcta: ejemplo real del fallo, marcado como histórico |
| `clientes:read`, `documentos:write`, «titular», «trabajador», «trabajador-premium» | `docs/ROLES.md:22-28` | ❌ **Incorrecta (menor)**: vocabulario de ANTARES presentado como ejemplo del modelo. Hay que sustituirlo por ejemplos neutros (`recurso:read`, «propietario», «miembro») |
| «consultable por el titular» | `modules/README.md:89` | ⚠️ Dudosa: vocabulario de ANTARES. Mejor «propietario de la cuenta» |
| Redirect de ejemplo con `"de": "/ayuda"` | `tests/public-docs.test.ts:115-117` | ⚠️ Dudosa: `/ayuda` era la ruta del centro de ayuda de ANTARES. Inocuo, pero conviene cambiarlo por una ruta neutra |
| «Datos de facturación» | `docs/RESTAURACION.md:49` | ✅ Correcta: histórica |
| Comentarios de la CLI sobre el «Supabase Pro plan» y «tenant» | `supabase/config.toml` | ✅ Correcta: texto de Supabase, no de ANTARES |

## 15. Bloqueantes

**B1 — Un proyecto nuevo que sigue el README tiene CI en rojo.**
`tests/public-docs.test.ts:120-128` sustituye el literal `domain: "app.example.com"` de
`project.ts`. En cuanto el proyecto pone su dominio (paso 2 del README), el reemplazo no
encuentra nada, el validador no ve error y el test falla. **Reproducido** en la
simulación: 77/78. El arreglo es de una línea: construir el valor a sustituir a partir
del dominio leído de `project.ts`, o escribir en el fichero temporal un dominio distinto
del que tenga. Lo mismo, aunque hoy pase por casualidad, con `/r3zon-template/no-existe`
en la línea 115.

No hay más bloqueantes.

## 16. Importantes (antes de congelar la v1.0)

- **I1 — Ejecutar los workflows en GitHub una vez**, en un repositorio creado con *Use
  this template*, y confirmar las versiones mayores vigentes de `actions/*`. Es la única
  pieza del flujo que no se ha visto funcionar.
- **I2 — Comprobar en CI que `database.types.ts` corresponde a las migraciones**
  (regenerar y comparar con `git diff --exit-code`). Hoy una migración sin `db:types`
  pasa CI con tipos viejos, y la regla de `CLAUDE.md` que lo exige queda sin guardarraíl.
- **I3 — Versionado de la plantilla y política de actualización de los derivados.**
  Etiquetar la plantilla (`v1.0.0`), que cada proyecto anote de qué versión nace, y
  escribir cómo recibe una mejora del core. Basta con una política sencilla, por ejemplo
  un `CHANGELOG` de la plantilla más cherry-pick desde un remoto `template`. Sin esto, el
  quinto proyecto tendrá su propio core distinto de los otros cuatro, que es justo lo que
  la plantilla quiere evitar.
- **I4 — Personalización comprobable y honesta.**
  - Que `docs:validar` (u otro comando) compare también nombre, slug, idioma y
    descripción de `project.ts` con `entidad.json` y avise si `config.toml` sigue en el
    rango de puertos de la plantilla.
  - Quitar `project.slug` y `project.organization`, o usarlos.
  - Decir junto a `homePath` que la carpeta y los tests también se renombran, y junto a
    `locale` que no traduce nada.
  - Unificar `site_url` y `NEXT_PUBLIC_SITE_URL` en local.
- **I5 — Qué hacer con cada documento al derivar**: conservar, vaciar o borrar
  `CHANGELOG`, `TAREAS` (sección «Plantilla»), `auditoria.md`, `mejoras.md` y este
  informe. Y una línea para las apps internas: `public_docs/` existe, pero no se da de
  alta en el Docusaurus.
- **I6 — Regla para actualizar dependencias con `allowScripts`**: una línea en
  `CLAUDE.md`/`STACK.md` («tras subir Prisma o Sentry, `npm install-scripts approve …`»)
  o evitar el anclaje por versión si npm lo permite (`allow-scripts-pin`; por verificar).
- **I7 — Decidir si «recuperar contraseña» sube al core.** Es la única pieza de
  `auth-advanced` que necesitan casi todos los productos con login por contraseña,
  incluidas las apps internas. Sin ella, quien la olvida depende de que un administrador
  la restablezca desde el panel de Supabase. Es una decisión, no un defecto.
- **I8 — Correcciones de documentación**:
  - `CLAUDE.md` §4, sobre lo que comprueba el catálogo;
  - «nueve» → 11 en `STACK.md`;
  - vocabulario de ANTARES en `ROLES.md` y `modules/README.md`;
  - un bloque de comandos en `CLAUDE.md`;
  - cómo añadir una variable de entorno en `DEVELOPMENT.md`.
- **I9 — `test:e2e` borra la base local de desarrollo** (`pretest:e2e` → `db:reset`).
  Hay que avisarlo en `DEVELOPMENT.md`, o volver a sembrar el usuario de desarrollo al
  terminar.

## 17. Mejoras posteriores

- Quitar `@vitejs/plugin-react` (comprobado innecesario).
- Reevaluar Prisma frente al drift de tipos (§13) tras el primer proyecto real.
- `supabase start -x …` en CI para acortar el arranque.
- Actions fijadas por SHA; Dependabot configurado teniendo en cuenta `allowScripts`.
- HSTS sin `preload` por defecto.
- Denegar también `Bash(cat .env*)` en `.claude/settings.json`.
- Esquema Zod para las variables de servidor cuando exista la primera.
- Apartado «cuando algo falla en producción» (Sentry, logs de Vercel, `/api/health`).
- Añadir `i18n` al catálogo de módulos (hay un producto real que lo usa).
- Podar el catálogo: `charts` y `analytics` como recetas; `mobile-capacitor` y
  `desktop-electron` con base común y la decisión «URL remota o bundle estático» escrita.
- Notificación a Discord también en E2E y Security.
- Abrir `engines` a Node 26 cuando sea LTS.
- Arreglar `llms*.txt` en R3ZON-Docusaurus (§8).
- Avisar de que `robots` y `sitemap` fijan su URL en el build (`NEXT_PUBLIC_SITE_URL`).
- Renombrar `src/app/auth/` o `(auth)/` para que no se parezcan.

## 18. Decisiones aceptadas

- Referencias históricas a ANTARES en documentación y comentarios (§14, filas ✅).
- UI en español y ruta `/inicio` sin i18n (R13), una vez documentado el alcance de
  `locale` (I4).
- `public_docs/` obligatorio en todos los proyectos. Publicarlo es opcional (se da de
  alta o no en el Docusaurus).
- Contrato de `public_docs` estricto (rechaza campos desconocidos) y con las reglas
  editoriales validadas.
- Sentry y Speed Insights en el core; Vercel Analytics como módulo.
- Sin CSP en el core; cabeceras básicas sí.
- `/api/health` público con el SHA del commit.
- Cookies de Supabase legibles desde el navegador (diseño de `@supabase/ssr`).
- Rutas `/api/*` sin gate en el proxy; la sesión la comprueba cada handler.
- 307 al login también para rutas inexistentes.
- TypeScript 7, CLI de Supabase como devDependency, `overrides` con vigilancia.
- Sistema de módulos como documento y copia manual; sin manifest hasta que haga falta.
- `fra1` y región UE por defecto.
- Margen de un día en «fecha no futura».
- Prisma en el core **para la v1.0** (revisable, §13).

## 19. Checklist para v1.0

```text
[x] No existen residuos funcionales de ANTARES          (quedan 3 textos menores: I8)
[x] Un proyecto nuevo puede arrancar desde cero          (reproducido en copia limpia)
[ ] La configuración está centralizada                  (sí para el código; duplicación en _meta sin validar: I4)
[x] public_docs funciona como contrato independiente    (validador + build real del Docusaurus)
[x] Los módulos están correctamente separados
[x] El core no contiene lógica de negocio
[ ] CI es reutilizable                                   (diseño sí; falta ejecutarlo en GitHub: I1, y los tipos: I2)
[ ] Tests son reutilizables                              (B1: un test ata la identidad de la plantilla)
[x] Seguridad core está definida
[ ] Documentación está completa                          (I3, I5, I8)
[x] CLAUDE.md está correctamente delimitado              (falta solo el bloque de comandos: I8)
[x] No existen dependencias innecesarias evidentes       (una menor: @vitejs/plugin-react)
[x] No existe sobrearquitectura crítica                  (Prisma, a reevaluar)
[x] El flujo Use this template está documentado
[ ] La plantilla puede considerarse candidata a v1.0     (sí, en cuanto se cierren B1 e I1–I9)
```

**Recomendación:** arreglar B1 ya, porque sin él el primer proyecto nace con CI en rojo.
Se puede empezar el primer proyecto real en paralelo a I1–I9, porque ninguno cambia la
arquitectura. Y conviene etiquetar la v1.0 cuando ese primer proyecto haya pasado por CI
en GitHub, que es la prueba que falta.

---

## 20. Cierre de v1.0

*2026-09-26* · Segunda pasada: se aplican los cambios necesarios según §15-§16. El
análisis de arriba se conserva tal cual; esta sección dice qué se hizo con cada punto.
Detalle y motivos: `docs/CHANGELOG.md`, iteración 2.

### Cambios realizados

| Punto | Estado | Qué se hizo |
|---|---|---|
| **B1** Test atado a la identidad de la plantilla | ✅ Cerrado | Fixtures autocontenidos en `tests/_fixtures/proyecto.ts`; `editar()` falla si el texto no existe; caso positivo de redirect añadido. Verificado en un proyecto personalizado |
| **I1** CI en GitHub | ⏳ **Abierto** | No se puede ejecutar sin push. Queda como tarea 🔴 en `TAREAS_PENDIENTES.md`, junto con revisar la versión de las actions |
| **I2** Tipos vs migraciones | ✅ | `npm run db:types:check` (compara sin escribir) como paso de `ci.yml` |
| **I3** Versionado y actualización | ✅ | `r3zon-template.json` (versión 1.0.0 y lo reservado), `docs/TEMPLATE.md` (semver, crear, actualizar con `git apply --3way` o `cherry-pick`, mantener) |
| **I4** Personalización comprobable | ✅ | `scripts/lib/identidad.mjs` en `docs:validar`, importando `project.ts` directamente; `slug`/`organization` con uso real; `homePath` y `locale` documentados y vigilados; `site_url` = `localhost:3000`; aviso de puertos reservados |
| **I5** Documentos al derivar | ✅ | Tabla en `TEMPLATE.md`; nada enlaza este informe; un test falla si un derivado lo conserva; `public_docs` en apps internas documentado |
| **I6** `allowScripts` | ✅ | Procedimiento en `STACK.md`, regla en `CLAUDE.md` §11 bis. Estrategia sin cambios |
| **I7** Recuperar contraseña | ✅ Decidido | Permanece en `auth-advanced` en v1.0 (`modules/README.md`, `AUTH.md`) |
| **I8** Documentación | ✅ | Catálogo descrito con exactitud; bloque de comandos; dependencias en tabla vigilada por test; vocabulario neutro; redirect neutro; variables de entorno |
| **I9** E2E borra la base local | ✅ Documentado | Aviso en `DEVELOPMENT.md` y en el bloque de comandos; comportamiento sin cambios |
| Catálogo de módulos | ✅ | `i18n` añadido; `charts` y `analytics` como recetas; estrategia cliente/servidor para móvil y escritorio |
| Seguridad | ✅ | HSTS sin `preload`; `.claude/settings.json` bloquea lectores de `.env*` por Bash y pide confirmación para `git tag` |
| Limpieza | ✅ | Fuera `@vitejs/plugin-react` |
| Producción | ✅ | `DEPLOYMENT.md` → «¿Qué hago cuando algo falla en producción?» |

### Tests ejecutados

Todos los comandos en WSL, Node 24.21. Primero sobre la plantilla y después sobre una
copia creada como *Use this template* («Acme Portal», puertos 5542x).

| Comprobación | Plantilla | Proyecto derivado |
|---|---|---|
| `npm ci` | ✅ | ✅ |
| `lint` · `typecheck` · `db:validate` | ✅ | ✅ |
| `npm run test` (con `CI=true`) | ✅ 96 tests, 12 ficheros | ✅ 96 tests, 12 ficheros |
| `npm run test:db` | ✅ 18 | (incluidos arriba) |
| `db:reset` + `db:drift` + `db:types:check` | ✅ | ✅ |
| `docs:validar` · `docs:enlaces` | ✅ (148 enlaces) | ✅ |
| `deps:overrides` · `npm audit` | ✅ 2 vigentes · 0 vulnerabilidades | — |
| `build` sin `.env.local` | ✅ | ✅ |
| `test:e2e` | ✅ 8 | ✅ 8 (con `homePath` cambiado a `/panel`) |
| `curl` sin cookie | ✅ públicas 200; `/inicio` y `/admin` 307 al login; HSTS sin `preload`; `og:locale` y `publisher` presentes | ✅ `<title>Acme Portal</title>`, `publisher` Acme, `/panel` 307 |
| Residuos (`clientes:read`, `documentos:write`, titular, trabajador, `/ayuda`, `tiene_permiso`, `tg_permiso`) | ✅ ninguno fuera de este informe | — |

**Casos negativos en el proyecto derivado** (tenían que fallar, y fallaron):

| Situación | Qué lo detectó |
|---|---|
| Solo `project.ts` personalizado | `docs:validar`: 12 errores, uno por fichero y campo; `project.test.ts` en rojo |
| Puertos de la plantilla conservados | `project.test.ts` → «es del rango reservado» |
| `auditoria-template-final.md` heredado | `project.test.ts` → «documentación de la plantilla» |
| Título de `index.md` sin cambiar | `docs:validar` |
| `homePath` cambiado sin renombrar la carpeta | `project.test.ts` → la página no existe |

Supabase local: el stack del proyecto derivado se paró al terminar. El de la plantilla
sigue levantado para desarrollo (`npm run db:stop` para pararlo).

### Problemas pendientes

1. **Los workflows no se han ejecutado nunca en GitHub (I1).** Es lo único del objetivo
   que no se puede verificar sin push. El riesgo es bajo, porque cada paso se ha
   reproducido en local sobre una copia limpia con `npm ci`, pero no es cero: el
   entorno del runner, las versiones de las actions y `supabase start` en
   `ubuntu-latest` solo se ven allí.

No queda ningún otro problema abierto de la auditoría.

### Decisiones congeladas para v1.0

- Node 24 (`engines` `>=24 <25`), Prisma 7 en el core (drift + Studio), CLI de Supabase
  como devDependency, `overrides` de `mysql2` y `deepmerge-ts`, estrategia de
  `allowScripts` con versión exacta.
- Sentry y Speed Insights en el core; analítica como receta.
- Recuperación de contraseña en `auth-advanced`.
- UI en español sin i18n (`locale` no traduce).
- `public_docs/` obligatorio; publicarlo, opcional.
- Sin CSP global.
- Actualización de proyectos derivados manual (`git apply --3way` / `cherry-pick`), sin
  sincronización automática.
- Sistema de módulos como documento, sin `manifest.json`.

### Mejoras explícitamente pospuestas a v1.1+

En `docs/mejoras.md`, cada una con su desbloqueo:

- reevaluar Prisma frente a `db:types:check`;
- `supabase start -x` en CI;
- actions fijadas por SHA y Dependabot;
- Discord en E2E y Security;
- renombrar `src/app/auth/` frente a `(auth)/`;
- Node 26;
- CSP;
- búfer de errores de Sentry;
- workflows de producción;
- `manifest.json` de módulos;
- `llms*.txt` en R3ZON-Docusaurus.

### Estado final

```text
READY FOR v1.0
```

Motivos objetivos:

- El bloqueante (B1) está cerrado y verificado en un proyecto derivado real, no solo en
  la plantilla.
- Un repositorio creado desde la plantilla y personalizado según `docs/TEMPLATE.md` pasa
  todas las comprobaciones: lint, tipos, 96 tests, drift, tipos generados, docs, build
  sin `.env.local` y 8 E2E.
- Los errores de personalización (identidad, puertos, documentos heredados, `homePath`)
  hacen fallar CI con un mensaje que dice qué fichero corregir.
- Hay versión (`r3zon-template.json` 1.0.0) y un procedimiento documentado para crear y
  actualizar proyectos.
- No quedan residuos de ANTARES fuera de las referencias históricas permitidas.

**Condición para el tag:** el código está listo para el commit. El tag `v1.0.0` debe
ponerse **después** de ver `ci.yml`, `e2e.yml` y `security.yml` en verde en GitHub (I1),
que es la única comprobación que no se ha podido hacer en local.
