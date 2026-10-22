# La plantilla: versiones, crear un proyecto y actualizarlo

Este documento es el mismo en la plantilla y en cada proyecto derivado. Explica de qué
versión del core parte un proyecto y cómo se mantiene al día, para que los proyectos A,
B y C no acaben con tres cores distintos.

## Versión

La versión del core está en [`r3zon-template.json`](../r3zon-template.json) (`version`):

| Repositorio | Qué significa `version` |
|---|---|
| La plantilla | La versión de la plantilla. Se etiqueta igual en git: `v1.0.0` |
| Un proyecto derivado | La versión de la plantilla de la que salió, o la última cuyo core ha incorporado |

`package.json` → `version` es la **versión del producto** y no tiene nada que ver con
esta. En la plantilla vale `0.1.0` y cada producto la gestiona a su manera.

**Semver de la plantilla:**

- **MAJOR**: un proyecto derivado necesita trabajo manual para adoptarla (cambia un
  contrato, una convención o una migración del core de forma incompatible).
- **MINOR**: algo nuevo en el core o en la documentación que se adopta aplicando los
  cambios.
- **PATCH**: correcciones.

Cada versión se anota en [«Versiones»](#versiones), al final de este documento, con lo
que un proyecto derivado debe saber para adoptarla. El detalle de cada cambio, con su
porqué, está en la bitácora de la plantilla (`docs/CHANGELOG.md` del repo de la
plantilla).

## Crear un proyecto

```text
R3ZON Template vX.Y.Z  ──(Use this template)──►  proyecto  (r3zon-template.json: vX.Y.Z)
```

### 1. Crear el repositorio

GitHub → *Use this template* sobre la versión etiquetada que se quiera usar
(normalmente `main` = la última). No lo hagas como fork: el producto no debe recibir ni
enviar cambios de la plantilla por accidente. `r3zon-template.json` **no se toca**:
registra de qué versión nace el proyecto.

### 2. Personalizar la identidad

| Dónde | Qué |
|---|---|
| [`src/config/project.ts`](../src/config/project.ts) | `name`, `slug`, `description`, `domain`, `organization`, `locale`, `homePath` (el comentario de cada campo dice qué hace) |
| [`package.json`](../package.json) | `name` = `slug` |
| [`supabase/config.toml`](../supabase/config.toml) | `project_id` = `slug`, y un **rango de puertos propio** (5532x está reservado para la plantilla) |
| [`public_docs/_meta/entidad.json`](../public_docs/_meta/entidad.json) | Dominio (en `sitioProducto`, `ids` y `sameAs`), `sitioDocumentacion` = `https://docs.r3zon.com/<slug>`, nombre, descripción, idioma y organización |
| [`public_docs/_meta/rutas-app.json`](../public_docs/_meta/rutas-app.json) | `base` = `https://<dominio>` y las rutas reales |
| [`public_docs/index.md`](../public_docs/index.md) | Título (con el nombre del producto) y descripción |
| [`src/app/globals.css`](../src/app/globals.css) | Paleta de marca |
| `src/app/icon.svg` | Icono (la plantilla no trae ninguno) |
| [`src/app/sitemap.ts`](../src/app/sitemap.ts) | Páginas públicas y sus fechas |
| [`README.md`](../README.md) | Reescribirlo para el producto (conserva «Arranque rápido» y «Comprobaciones») |
| [`CLAUDE.md`](../CLAUDE.md) §0 | Invariantes: entornos, datos de producción, alcance |
| [`.github/workflows/`](../.github/workflows/ci.yml) | Ramas largas en `on.push.branches` (`ci.yml` y `e2e.yml`) |
| [`vercel.json`](../vercel.json) | Región, solo si hay un motivo para no usar `fra1` |

**Qué se comprueba solo** (CI lo ejecuta):

- `npm run docs:validar` falla si `package.json`, `config.toml`, `entidad.json`,
  `rutas-app.json` o el título de `index.md` no coinciden con `project.ts`.
- `npm run test:run` (en [`tests/unit/project.test.ts`](../tests/unit/project.test.ts))
  falla si:
  - un proyecto con slug propio sigue en los puertos de la plantilla;
  - conserva documentos exclusivos de la plantilla;
  - `homePath` no corresponde a ninguna página.

Dos campos de `project.ts` no hacen lo que su nombre podría sugerir:

- **`homePath`**: cambiarlo implica **renombrar la carpeta** `src/app/(app)/inicio/` y su
  entrada en `rutas-app.json`. Los tests y los E2E leen el valor, así que no hay que
  tocarlos.
- **`locale`**: configura `<html lang>`, `og:locale` e `inLanguage`. **No traduce la
  interfaz**: los textos están en español en los componentes. Un producto en otro idioma
  los reescribe; uno con varios idiomas necesita el módulo `i18n`.

### 3. Documentación al derivar

La plantilla trae documentos de dos tipos: los que pasan a ser del producto y los que
solo tienen sentido en la plantilla.

| Fichero | En la plantilla | En el proyecto derivado |
|---|---|---|
| `docs/CHANGELOG.md` | Bitácora de la plantilla | **Se vacía** y empieza con `### Iteración 1 — *fecha* — Proyecto creado desde R3ZON Template vX.Y.Z` |
| `docs/TAREAS_PENDIENTES.md` | Tareas de la plantilla | **Se vacía.** Las tareas de la sección «Al crear un proyecto» pasan a ser las primeras del producto |
| `docs/auditoria.md` | Auditorías de seguridad del core | **Se vacía** (se conserva el formato). Los hallazgos abiertos del core que afectan al producto (CSP) ya están en esas primeras tareas |
| `docs/mejoras.md` | Propuestas para la plantilla | **Se vacía.** Las mejoras del core se siguen en el repo de la plantilla |
| `docs/auditoria-template-final.md` | Auditoría de la v1.0 de la plantilla | **Se borra.** Un test falla si un proyecto derivado lo conserva |
| `docs/TEMPLATE.md` (este) | Procedimiento | Se conserva: es como se actualiza el proyecto |
| `r3zon-template.json` | Versión de la plantilla | Se conserva; se cambia solo al incorporar una versión nueva |
| Resto de `docs/`, `CLAUDE.md`, `modules/` | Documentación del core | Pasa a ser del producto y se mantiene como tal |

**`public_docs/` en una aplicación interna.** El directorio existe siempre (es core, y
su validador corre en CI), pero **publicarlo es opcional**: solo se publica si el
producto se da de alta en `R3ZON-Docusaurus/config/products.ts`. Una app interna no se
da de alta, y su `public_docs/` sirve como manual de uso dentro del repositorio.

### 4. Arrancar y dar de alta los servicios

`npm ci && npm run dev:setup`, y después los servicios externos según
[DEPLOYMENT.md](DEPLOYMENT.md). Decide los módulos
([`modules/README.md`](../modules/README.md)) y apúntalos en [MODULES.md](MODULES.md).

## Actualizar un proyecto con una versión nueva de la plantilla

No hay sincronización automática, a propósito: cada proyecto decide cuándo adopta una
versión y revisa lo que entra. Un repositorio creado con *Use this template* no comparte
historia con la plantilla, pero git puede aplicar sus cambios igualmente:

```bash
# Una vez por clon: la plantilla como remoto de solo lectura.
git remote add plantilla git@github.com:<organización>/<repo-de-la-plantilla>.git

# 1. Traer las versiones etiquetadas.
git fetch plantilla --tags

# 2. Ver qué ha cambiado entre la versión del proyecto y la nueva.
#    (la actual está en r3zon-template.json)
git log --oneline v1.0.0..v1.1.0
git diff --stat v1.0.0 v1.1.0

# 3. En una rama, aplicar los cambios del core.
git switch -c plantilla-v1.1.0
#    Fuera: los documentos que son de la plantilla y el contenido público de ejemplo.
#    Entran el contrato (public_docs/README.md, CONVENCIONES.md) y r3zon-template.json.
git diff v1.0.0 v1.1.0 -- . ':(exclude)docs/CHANGELOG.md' ':(exclude)docs/TAREAS_PENDIENTES.md' \
  ':(exclude)docs/auditoria.md' ':(exclude)docs/mejoras.md' ':(exclude)docs/auditoria-template-final.md' \
  ':(exclude)public_docs/_meta' ':(exclude)public_docs/index.md' | git apply --3way
#    Alternativa, commit a commit: git cherry-pick -x <sha>
```

Después:

1. **Resolver conflictos** donde el producto haya cambiado lo mismo. `--3way` deja
   marcas de conflicto en vez de fallar; la identidad del producto (`project.ts`,
   `_meta/`, `package.json`) prevalece siempre.
2. **Migraciones del core nuevas**: se renombran con la fecha de hoy
   (`npx supabase migration new …` y se copia el contenido). Si conservan su fecha
   original, quedan por detrás de las del producto, y `supabase db push` se niega a
   insertar una migración anterior a la última aplicada.
3. `npm ci`, y si cambió alguna dependencia con scripts de instalación, el procedimiento
   de [STACK.md](STACK.md) → `allowScripts`.
4. `npm run db:reset && npm run db:pull && npm run db:types` si entraron migraciones.
5. Todas las comprobaciones de [`CLAUDE.md`](../CLAUDE.md) §3.
6. Comprobar que `version` de `r3zon-template.json` ya dice la versión nueva (llega con
   el diff) y escribir la entrada en la bitácora del producto: qué versión, qué se
   adoptó y qué se dejó fuera, y por qué.

Saltar versiones (de v1.0.0 a v1.3.0) funciona igual con el diff entre las dos
etiquetas. Lee antes las notas de cada versión intermedia en «Versiones».

**Y al revés:** si un producto mejora algo del core que sirve a todos, la mejora se
propone en el repositorio de la plantilla, sale en una versión y los demás productos la
adoptan desde ahí. Nunca se copia de un producto a otro.

## Mantener la plantilla

- Todo cambio de la plantilla sigue [`CLAUDE.md`](../CLAUDE.md) como cualquier proyecto:
  tests, bitácora y documentación.
- Para publicar una versión:
  1. Subir `version` en `r3zon-template.json`.
  2. Escribir su entrada en «Versiones».
  3. Commit y etiqueta `vX.Y.Z` (la etiqueta la pone quien mantiene la plantilla).
- Lo específico de un producto no entra nunca en la plantilla.

## Versiones

### v1.0.0 — *pendiente de etiquetar*

Primera versión estable. Core:

- Next.js 16, TypeScript, Tailwind 4 y Zod.
- Supabase con `public.profiles`, RLS y test de catálogo de seguridad.
- Auth mínima: login con email y contraseña, callback, logout y gate de rutas.
- Prisma solo para drift y Studio.
- Tests (unitarios, componentes, jest-axe, BD real, E2E).
- CI (calidad, E2E y seguridad).
- Sentry y Speed Insights.
- `public_docs/` con validador.
- Documentación y catálogo de módulos (ninguno implementado).

Adopción: es la versión inicial; no hay nada que adoptar.
