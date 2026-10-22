# Instrucciones para Claude

Este repositorio (**Excelsior**, el área de clientes de R3ZON) nace de la **plantilla de
proyectos SaaS de R3ZON**. Aquí están las
reglas que cambian cómo se trabaja; el resto está en [`docs/`](docs/README.md). Cada
regla lleva su motivo: una norma sin motivo se salta en cuanto estorba.

## 0. Invariantes del proyecto

> Mantener al día. Son los hechos que cambian cómo se interpreta cualquier medición o
> tarea.

- **Producto:** **Excelsior** (nombre interno), el área de clientes de R3ZON en
  `clientes.r3zon.com`: invitación → contrato → pago → briefing, y después servicios,
  propuestas, documentos y tickets. Qué y por qué: [`docs/PRODUCTO.md`](docs/PRODUCTO.md).
  Identidad en código: [`src/config/project.ts`](src/config/project.ts) (**aún con los
  valores de la plantilla**: se personaliza en la Fase 0).
- **Plan y fase en curso:** [`docs/PLAN.md`](docs/PLAN.md). Hoy: **Fase 0**. Las
  decisiones tomadas (T-xx) no se reabren sin preguntar; las abiertas (D-xx) se preguntan
  antes de implementar lo que bloquean.
- **Entornos:** local (Supabase en Docker) · producción (Vercel + Supabase Cloud),
  **todavía sin crear**.
- **Datos de producción:** ninguno. No hay clientes reales (2026-10-22).
- **Alcance:** solo web responsive (móvil, tablet, escritorio) con la estética de
  r3zon.com; solo español; solo Stripe como pasarela. Fuera de alcance y quién puede
  reabrirlo: [`docs/PRODUCTO.md`](docs/PRODUCTO.md) §8 — lo reabre R3ZON, nunca una tarea.
- **Seguridad del producto:** sin registro público; los clientes nunca ven datos de otro
  cliente; el staff ve todo por permiso, no saltándose la RLS
  ([`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §16).
- **Módulos instalados:** ver [`docs/MODULES.md`](docs/MODULES.md).

## Comandos

```bash
npm ci                    # instalar (Node 24: nvm use)
npm run dev:setup         # Supabase local + .env.local + usuario dev (idempotente)
npm run dev               # app en http://localhost:3000
npm run lint              # Biome (lint:fix para corregir)
npm run typecheck
npm run test:run          # todos los tests de Vitest (los de BD necesitan el stack)
npm run test:db           # solo los de base de datos
npm run test:e2e          # Playwright — RESETEA la base local (luego: npm run seed:dev)
npm run build
npm run docs:validar      # public_docs + identidad del proyecto
npm run docs:enlaces      # enlaces de docs internos
npm run db:start | db:stop | db:reset     # Supabase local
npm run db:pull && npm run db:types       # tras una migración nueva
npm run db:drift && npm run db:types:check  # ¿schema.prisma y tipos al día?
npm run seed:dev          # recrear el usuario de desarrollo
```

## 1. Pregunta antes de decidir algo importante

Si una decisión cambia la **arquitectura, la seguridad, el modelo de datos, el alcance o
algo que el usuario percibe**, pregunta antes y espera respuesta. No la tomes en silencio,
aunque parezca evidente. Las decisiones menores se toman eligiendo la opción más sencilla,
y se dejan escritas (en la bitácora o en el comentario del código).

Motivo: una decisión importante tomada en silencio se descubre tarde, cuando ya hay
código encima.

## 2. Git

**Nunca ejecutes `git commit` ni `git push` sin autorización explícita.** Deja los
cambios en el árbol de trabajo y di qué hay listo. El commit y el push los decide el
usuario.

- **La autorización no se hereda.** Aprobar un push no aprueba el siguiente.
- **Mencionar el push no es autorizarlo.** «Luego pusheamos» o «migra la base para
  poder pushear» describen un plan, no dan permiso.
- **Pegar el log de un fallo es pedir un diagnóstico**, no un despliegue. Corregir un
  error propio tampoco autoriza a subir la corrección.
- Importa sobre todo en `main`: cada push despliega a producción.

> Precedente (proyecto de origen, 2026-08-15): dos push sin permiso. El primero se
> justificó con un «para poder pushear» del usuario; el segundo, tras pegar un log.

**Mensajes de commit: Conventional Commits en inglés técnico.**
`feat(scope): add …` · `fix(auth): handle expired session` · `refactor(db): …` ·
`docs: …` · `test: …` · `chore: …` · `ci: …`.

`.claude/settings.json` pide confirmación para `git commit` y `git push`: es la red,
no la regla.

## 3. Definición de «hecho»

Una tarea está terminada cuando **todo** esto es verdad:

1. `npm run lint`, `npm run typecheck` y `npm run test:run` en verde.
2. Hay **test nuevo de lo nuevo** (y de la regresión, si era un fallo).
3. Si tocó la base: migración nueva + `npm run db:pull` + `npm run db:types`, y
   `npm run db:drift` y `npm run db:types:check` en verde.
4. Si tocó rutas o auth: `npm run test:e2e` en verde, y las URLs comprobadas sin cookie
   (§10).
5. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) tiene su entrada, con el **porqué**.
6. [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md) al día: lo cerrado, borrado;
   **lo que ha salido, añadido**.
7. Si cambió algo que describe `docs/` o `public_docs/`, está actualizado, con su fecha.
8. Los cambios están **en el árbol de trabajo** y has dicho qué hay listo.

Motivo: documentar «al final» no ocurre. En el proyecto de origen se acumularon seis
commits sin documentar y los docs acabaron describiendo un estado que ya no existía,
que es peor que no tenerlos.

## 4. Base de datos y migraciones

- **El esquema vive en un único sitio: `supabase/migrations/`.** No hay `schema.sql` de
  apoyo ni scripts de «setup». Dos vías divergen, y lo hacen en silencio.
- **Una migración aplicada no se edita jamás.** Si falta algo, migración nueva. Editar
  una aplicada crea una divergencia que solo se ve en producción (pasó: tres `db push`
  fallidos en el proyecto de origen), y `npm run db:reset` en local no la detecta.
- **Toda migración nueva viaja con su `prisma/schema.prisma` y sus tipos:** aplicarla en
  local, `npm run db:pull`, `npm run db:types`, y todo en el mismo commit. CI lo exige.
- **Prisma es solo para local y pruebas** (introspección, Studio, drift). **Nunca**
  `prisma db push` ni `prisma migrate`, ni Prisma Client dentro de la app, ni editar
  `schema.prisma` a mano. La app habla con Supabase por `supabase-js` y RLS.
- **Toda tabla nueva llega con:** RLS activada, policies por acción, grants mínimos
  explícitos (Supabase concede todo por defecto), índices de sus FK y tests contra
  Postgres. `tests/db/security-catalog.test.ts` vigila **parte** de esto sobre todo el
  catálogo: RLS activada, ningún grant a `anon`, índices de las FK, y que ninguna
  `SECURITY DEFINER` sea ejecutable por `anon`, ni por `authenticated` sin estar
  declarada, ni carezca de `search_path`. **No comprueba** que existan policies, ni los
  grants de `authenticated`, ni que haya tests: eso lo revisas tú.
- **Las reglas de negocio van en triggers sobre la tabla**, no en guardas dentro de cada
  RPC ni en el cliente. La RLS **no se aplica dentro de una `SECURITY DEFINER`**: una
  guarda por RPC deja fuera la ruta que alguien olvide. Lo del cliente es UX.
- `gen_random_uuid()`, nunca `uuid_generate_v4()` (en Supabase `uuid-ossp` vive en
  `extensions` y no resuelve sin cualificar).
- Toda `SECURITY DEFINER` lleva `set search_path = ''` y nombres cualificados, y se
  revoca `EXECUTE` a quien no deba llamarla.
- **Antes de un `db push` a producción**, compara con el esquema real
  (`npx supabase db dump --schema public -f <fichero>`). Solo con autorización.

Guía completa: [`docs/DATABASE.md`](docs/DATABASE.md).

## 5. Seguridad

- **La RLS es la verja de los datos.** El frontend no filtra por usuario ni por tenant a
  mano: usa el cliente de Supabase con la sesión y deja que la RLS filtre.
- **La `service_role` nunca entra en código de la app.** Solo en scripts locales y CI.
- **Rutas públicas: una lista explícita** en [`src/lib/public-paths.ts`](src/lib/public-paths.ts).
  Todo lo demás exige sesión. Una página pública nueva se añade ahí y a su test.
- **Redirecciones que vienen de fuera** (`?redirect=`, `?next=`) pasan siempre por
  `safeRedirectPath`.
- **Secretos:** nunca con prefijo `NEXT_PUBLIC_`, nunca en el repo, nunca en logs (el
  logger y Sentry los redactan; no los esquives).
- **Dato personal:** si puedes evitar guardarlo o duplicarlo, evítalo. Lo que no existe
  no hay que proteger, exportar ni borrar.
- No leas `.env.local` ni ficheros de secretos, por ninguna vía. `.claude/settings.json`
  bloquea `Read` y los lectores habituales por Bash (`cat`, `head`, `tail`, `less`…),
  pero es una red, no una garantía: la regla es no leerlos.

## 6. Tests

- **Test nuevo de lo nuevo.** Si arreglas un fallo, primero un test que lo reproduzca.
- **Lo que protege los datos se prueba contra Postgres real** (`tests/db/`), con
  `actAs()` y transacción con rollback. Un mock de Supabase no prueba la RLS.
- **Un test de BD no puede pasar en silencio.** En CI falla si no hay base; en local se
  salta con aviso. No lo cambies: una suite que se salta sola da una tranquilidad falsa.
- Componentes: Testing Library (por rol y etiqueta, como un usuario) + jest-axe.
- E2E (`e2e/specs/`): recorridos críticos contra el build de producción y el Supabase
  local. Si cambias login, rutas o el gate, se actualizan.
- No borres ni debilites un test para que pase. Si el test estaba mal, dilo y explícalo.

## 7. Documentación interna (`docs/`)

**Bitácora — [`docs/CHANGELOG.md`](docs/CHANGELOG.md).** Al cerrar un bloque de
trabajo, arriba del todo:

```
### Iteración N — *YYYY-MM-DD* — Título
```

Contexto en un párrafo y bullets. **El porqué, no solo el qué**: dentro de tres meses el
qué está en el diff y el porqué no. Incluye lo **descartado** y los errores propios del
camino. El número solo tiene que ser único: **nunca se renumera**.

**Tareas — [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md).** Solo tareas
abiertas. `[ ]` pendiente · `[~]` en curso · prioridad 🔴 🟠 🟡 🟢. Al cerrar una,
**se borra la línea** y se escribe en la bitácora. Arriba, «Estado hoy» con cifras
reales y su fecha. **Lo que no es una tarea no vive ahí**: una regla va aquí, a
CLAUDE.md; una «tarea» que no se puede cerrar nunca es una regla disfrazada.

Si un cambio afecta a lo que describe un documento de `docs/`, se actualiza en la misma
tarea. Un documento desactualizado es trabajo incompleto.

## 8. Anunciar al usuario lo que cambia

**Todo cambio que el usuario pueda percibir se le anuncia**, en el mismo commit que el
cambio. Si no le cambia nada (refactor, tipos, tests, migraciones internas), **no se
anuncia**: un aviso lleno de ruido interno deja de leerse.

El mecanismo lo aporta el módulo `whats-new` ([`modules/README.md`](modules/README.md)).
**Mientras no esté instalado**, no hay dónde anunciar: menciónalo al entregar para que el
usuario decida. Cuando se instale, su README añade aquí el procedimiento concreto.

La bitácora (`docs/CHANGELOG.md`) y el anuncio al usuario son registros distintos: uno lo
lee quien mantiene el código, el otro quien usa el producto.

## 9. Documentación pública (`public_docs/`)

`public_docs/` es la documentación pública del producto, que publica el repositorio de
Docusaurus de R3ZON. **Este repo es la fuente de verdad**; aquel solo la consume.
Contrato: [`public_docs/README.md`](public_docs/README.md). Redacción:
[`public_docs/CONVENCIONES.md`](public_docs/CONVENCIONES.md).

- **`last_update.date` se actualiza a mano, en el mismo commit** en que cambia un paso,
  el nombre de un botón o un límite. Una errata no mueve la fecha. Nunca se deriva de git
  ni de `new Date()`: la sincronización copia el árbol entero y todas las páginas
  saldrían con la misma fecha.
- Lo mismo con las fechas literales de [`src/app/sitemap.ts`](src/app/sitemap.ts): quien
  cambia el contenido visible de una página pública, cambia su fecha ahí.
- **Verifica cada dato contra el código** antes de escribirlo. Si el código se contradice,
  no elijas: anótalo como bloqueante en TAREAS y no escribas esa página.
- Solo Markdown y JSON de datos: **nada de lógica de Docusaurus** aquí.
- Si cambias una ruta que aparece en `public_docs/_meta/rutas-app.json` o renombras una
  página, actualiza `_meta/` en el mismo commit.
- `npm run docs:validar` en verde forma parte de «hecho».

## 10. Dos comprobaciones que ninguna puerta hace por ti

- **Tras tocar rutas raíz o el proxy, pide las URLs sin cookie** (`curl -I`): públicas
  → 200, protegidas → 307 a `/login`. El código compila y los tests pasan, pero una ruta
  pública que cae detrás del login solo la ve quien la pide sin sesión. En el proyecto de
  origen cazó tres casos del mismo patrón.
- **No midas contra producción sin usuarios** como si fueran datos. Mientras no haya
  clientes reales, «cero registros en X» no dice que X funcione ni que falle. Lo que no
  depende de usuarios (grants, policies, migraciones, configuración) sí vale igual.

## 11. Core y módulos

- El **core** es lo que trae la plantilla: se usa en todos los productos. Cambiar el core
  de un proyecto es una decisión importante (§1): si la mejora sirve a todos, se propone
  para la plantilla.
- Un **módulo** se instala copiándolo de la plantilla según su README
  ([`modules/README.md`](modules/README.md)), y se apunta en `docs/MODULES.md` y en la
  bitácora. No se modifica el core por dentro para encajarlo.
- Lo específico de este producto vive en este producto: no se sube a la plantilla.
- La versión del core que tiene el repo está en `r3zon-template.json`. Solo cambia al
  incorporar una versión nueva de la plantilla, con el procedimiento de
  [`docs/TEMPLATE.md`](docs/TEMPLATE.md). No es la versión del producto
  (`package.json`).

## 11 bis. Dependencias

- Tras instalar o actualizar un paquete, si npm avisa de *install scripts not covered
  by allowScripts*: `npm install-scripts ls`, revisa qué ejecuta cada script y apruébalo
  con `npm install-scripts approve <paquete>`. Commitea `package.json` y el lockfile
  juntos. Motivo: npm 11 **omite en silencio** los scripts no aprobados, y la aprobación
  va ligada a la versión exacta. Una actualización de Prisma sin aprobar deja sin motor
  a `db:pull` y `db:drift`, y CI falla con un error que no apunta a la causa. Detalle en
  [`docs/STACK.md`](docs/STACK.md).
- Un `override` solo con motivo escrito en `docs/STACK.md`; `npm run deps:overrides` dice
  si sigue haciendo falta.

## 12. Herramientas opcionales

Nada de esto es requisito para desarrollar, probar ni desplegar.

- **graphify** (grafo de conocimiento del repo): si está instalado en la máquina y existe
  `graphify-out/`, consúltalo antes de abrir ficheros a ciegas (`graphify query "…"`).
  `graphify-out/` está en `.gitignore`. Instalación: `pipx install "graphifyy[sql]"` (el
  extra `[sql]` es necesario para que las migraciones entren en el grafo).
- **Servidores MCP** (Supabase, Vercel, Sentry, GitHub): configuración local de cada
  máquina; el repo no incluye `.mcp.json`. Ejemplo en
  [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Contra producción, siempre en modo solo
  lectura.

## 13. Next.js

Este proyecto usa **Next.js 16**: el antiguo `middleware.ts` es `src/proxy.ts`, y hay
APIs que difieren de lo que puede recordar tu entrenamiento. Ante la duda, lee la guía
en `node_modules/next/dist/docs/` antes de escribir código.
