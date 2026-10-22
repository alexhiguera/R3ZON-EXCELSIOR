# `public_docs/` — contrato con el repositorio de documentación

Contenido Markdown de la documentación pública del producto. **Se escribe y se mantiene
aquí**, en el repositorio del producto. El repositorio de Docusaurus de R3ZON
(`R3ZON-Docusaurus`, que publica `docs.r3zon.com`) lo **consume** y lo publica.

> Este fichero, `CONVENCIONES.md` y todo lo que empieza por `_` **no se publican**.
> Docusaurus ignora `**/_*` de serie, y su configuración excluye `README.md` y
> `CONVENCIONES.md` (`DEFAULT_DOC_EXCLUDES`).

Este contrato es común a todos los productos de R3ZON. Si un producto necesita
cambiarlo, el cambio se hace **en los dos repositorios a la vez** y se escribe aquí.

> **Existir no es publicarse.** Todo proyecto tiene `public_docs/` y lo valida en CI,
> pero solo se publica si se da de alta en `R3ZON-Docusaurus/config/products.ts` (§3).
> Una aplicación interna no se da de alta: su `public_docs/` es el manual de uso dentro
> del repositorio y no sale de él.

---

## 1. Por qué el contenido vive en el producto

Porque el repositorio del producto es el único sitio donde se puede comprobar si el
texto dice la verdad: el botón que nombra una guía existe o no existe en `src/`, y un
límite coincide o no con el código. El sitio de documentación no puede saberlo.

## 2. Qué NO hace el repositorio de Docusaurus

**No edita ningún `.md`, ningún frontmatter ni ningún `_category_.json`.** Toda edición
hecha allí se pierde en la siguiente sincronización. Si algo está mal, se corrige aquí.

Y al revés: **aquí no hay lógica de Docusaurus.** Solo Markdown (`.md`) con frontmatter
YAML y ficheros JSON de datos. Nada de MDX, componentes, `import`/`export`, plugins ni
configuración del sitio. El validador lo impide.

## 3. Qué SÍ hace el repositorio de Docusaurus

- Tema, navegación, buscador e i18n.
- Emitir el JSON-LD a partir del frontmatter (§6).
- `sitemap.xml`, `robots.txt` y los `llms*.txt`.
- El botón «Abrir en la app», resuelto contra `_meta/rutas-app.json`.
- Validar en su build lo mismo que valida aquí `npm run docs:validar`.

Para dar de alta un producto nuevo allí basta con una entrada en su
`config/products.ts`:

```ts
{
  id: '<slug>',                       // = project.slug → ruta /<slug>
  name: '<Nombre>',
  tagline: '<frase>',
  kind: 'saas',
  appUrl: 'https://<dominio>',
  emoji: '🧩',
  status: 'stable',
  source: { repo: '<owner>/<repo>', branch: 'main', path: 'public_docs', tokenEnv: 'DOCS_SYNC_TOKEN' },
}
```

Su script `sync-docs` hace un clon superficial de `path` en `branch` y lo copia a
`docs/<id>/`. Los plugins SEO de R3ZON se activan solos cuando encuentran
`_meta/entidad.json`: por eso ese fichero existe desde el primer día.

## 4. Estructura

```
public_docs/
├── README.md            ← este contrato (no se publica)
├── CONVENCIONES.md      ← guía de redacción (no se publica)
├── _meta/               ← datos para el repo de docs (no se publica)
│   ├── entidad.json     ← identidad schema.org compartida por app y docs
│   ├── rutas-app.json   ← rutas reales de la app (botón «Abrir en…»)
│   └── redirects.json   ← mapa de URLs antiguas → nuevas
├── index.md             ← portada del producto (slug: /)
└── <seccion>/           ← una carpeta por sección, con su _category_.json
    ├── _category_.json
    └── <pagina>.md
```

Obligatorios: `README.md`, `CONVENCIONES.md`, `index.md` y los tres de `_meta/`.

**El árbol no lleva prefijo de producto** (`<slug>/`): lo pone el `routeBasePath` del
Docusaurus. Duplicarlo produce `/<slug>/<slug>/…`.

Los nombres de carpeta y fichero son **slugs de SEO**, no ids de código: se eligen por
cómo busca la gente, y cambiarlos exige una entrada en `_meta/redirects.json`.

## 5. Frontmatter

Todo lo propio de R3ZON va bajo **una única clave `r3zon`**.

```yaml
---
title: "Cómo iniciar sesión"
sidebar_label: "Iniciar sesión"      # opcional
sidebar_position: 1                   # opcional
slug: /primeros-pasos/iniciar-sesion
description: "Frase que responde a la pregunta. 150-160 caracteres."
keywords: [iniciar sesión, acceder]   # opcional
tags: [cuenta]                        # opcional
last_update:
  date: 2026-09-23
  author: Equipo R3ZON                # opcional
r3zon:
  tipo: guia
  jsonld: HowTo
  estado: publicado
  intencion: "¿Cómo entro en mi cuenta?"   # opcional
  app_url: /login                          # opcional; debe estar en _meta/rutas-app.json
  origen: src/app/(auth)/login/page.tsx     # opcional; fichero del repo que la página describe
---
```

### Campos obligatorios

`title` · `slug` · `description` · `last_update.date` · `r3zon.tipo` · `r3zon.jsonld` ·
`r3zon.estado`

`slug` es obligatorio **siempre**, aunque coincida con el nombre del fichero: la URL no
puede moverse porque alguien renombre un fichero.

### Valores válidos

| Campo | Valores |
|---|---|
| `r3zon.tipo` | `guia` · `concepto` · `faq` · `problema` · `referencia` · `caso-uso` · `glosario` · `indice` |
| `r3zon.jsonld` | `HowTo` · `FAQPage` · `TechArticle` · `DefinedTermSet` · `Article` · `none` |
| `r3zon.estado` | `publicado` · `proximamente` |

**Ningún otro campo está permitido.** El validador rechaza claves desconocidas para que
el contrato no crezca en silencio por un lado y no por el otro.

> **Qué se quedó fuera y por qué.** El contrato de origen tenía además `r3zon.modulo`,
> `r3zon.plan_minimo` y `r3zon.permiso`. Sus valores eran los módulos, los planes y los
> permisos de UN producto concreto, no un concepto común a todos. El Docusaurus los
> trata como opcionales, así que un producto sin ellos se publica igual. Si un producto
> los necesita (p. ej. con el módulo `billing-stripe`), los reintroduce en su repo y en
> el validador de Docusaurus, con sus valores, y lo documenta aquí.

### `estado: proximamente`

Para funcionalidad anunciada pero no disponible. Se publica con aviso visible y
**nunca con `jsonld: HowTo`**: no se le describen pasos a una IA para algo que todavía
no se puede hacer.

## 6. JSON-LD que deriva el Docusaurus

| `r3zon.jsonld` | Se emite | Requisito en la página |
|---|---|---|
| `HowTo` | `HowTo` con `step[]` | Un `## Cómo …` con **lista ordenada** debajo (lo exige el validador) |
| `FAQPage` | `FAQPage` | Preguntas como `###` bajo «Preguntas frecuentes» |
| `TechArticle` | `TechArticle` | — |
| `DefinedTermSet` | `DefinedTermSet` | Cada `##` es un término |
| `Article` | `Article` | — |

`dateModified` sale de `last_update.date`, **nunca de git** (§8).

## 7. Enlaces e idioma

- Los enlaces internos van **relativos a fichero** (`../seccion/pagina.md`), nunca como
  URL absoluta: Docusaurus los valida en build y los traduce si llega otro idioma.
- El árbol es el **idioma por defecto** del producto (`project.locale`). No lleva
  carpeta de idioma dentro. Una traducción se entregaría como árbol espejo aparte.

## 8. Fechas — la regla más importante

`last_update.date` es **literal, obligatoria y se actualiza a mano**:

1. Se toca **en el mismo commit** en que cambia un paso, el nombre de un botón o un
   límite. Si solo se corrige una errata, no.
2. **El Docusaurus no debe derivar la fecha de git.** La sincronización copia el árbol
   entero de una vez: con la fecha del commit, todas las páginas saldrían con la misma
   fecha en cada sync, y el buscador acaba ignorando la señal entera.
3. Nunca `new Date()` en nada que produzca `lastmod`.

El validador comprueba que la fecha existe, es válida y no está en el futuro. Lo que no
puede comprobar es que se haya actualizado: eso es disciplina (CLAUDE.md).

## 9. Validaciones

`npm run docs:validar` (y CI) comprueba:

- Estructura obligatoria del §4 y `_meta/` bien formado.
- Frontmatter: obligatorios, valores válidos, campos permitidos y `slug` único.
- `last_update.date` válida y no futura.
- `HowTo` con procedimiento real; `proximamente` sin `HowTo`.
- Cada `r3zon.app_url` está en `rutas-app.json`, y cada ruta de `rutas-app.json`
  existe en `src/app/`.
- `entidad.json`, `rutas-app.json` y el título de `index.md` coherentes con
  `src/config/project.ts`: dominio, nombre, descripción, idioma, organización y ruta
  `/<slug>` de la documentación.
- Cada destino de `redirects.json` es una página real.
- Enlaces internos relativos, a `.md` que existen y se publican.
- Nada de MDX. Cuerpo que empieza por `**Respuesta corta.**` (CONVENCIONES).

## 10. `_meta/`

- **`entidad.json`** — `@id` de schema.org de la organización, el sitio y la aplicación,
  compartidos por la app y la documentación. Dos dominios que declaran la **misma**
  entidad se refuerzan; si declaran entidades distintas, se diluyen. El Docusaurus usa
  estos `@id` literalmente.
- **`rutas-app.json`** — rutas reales de la app, con su etiqueta, en tres grupos que el
  Docusaurus lee siempre: `modulos`, `otras` y `publicas` (pueden estar vacíos, pero
  deben existir). `base` es la URL de la app.
- **`redirects.json`** — `{ "redirects": [{ "de": "…", "a": "/<slug>/…" }] }`. Cada URL
  antigua va a la página que responde a la misma pregunta; nunca todas a la portada
  (se tratan como soft-404). Si el origen es una ruta de la app (otro dominio), el 301
  lo emite la app, no el Docusaurus.

## 11. Sincronización y versionado

- **Sin automatizar desde aquí.** El Docusaurus tira del repo en su build. Este repo no
  empuja nada ni guarda credenciales del otro.
- **Sin versionado.** Un SaaS solo tiene la versión que está en producción: se
  documenta lo que hay hoy.
