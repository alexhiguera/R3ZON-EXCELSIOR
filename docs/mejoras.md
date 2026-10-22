# Mejoras propuestas

Propuestas que **no son tareas todavía**: cada una dice qué la desbloquea. Cuando se
cumple el desbloqueo, pasa a [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

---

### Content-Security-Policy

Una CSP estricta con nonces para scripts. **No está en la plantilla** porque sus
`connect-src`, `img-src` y `script-src` dependen de los terceros de cada producto
(Supabase, Sentry, Stripe, Vercel…), y una CSP genérica o es tan abierta que no sirve o
rompe algo.

Cuidado conocido: si la CSP se deriva de `NODE_ENV`, `next start` contra un Supabase
local la aplica como producción y bloquea las llamadas al stack local; el login falla sin
ningún error visible. Hay que derivarla del destino real (`NEXT_PUBLIC_SUPABASE_URL`).

**Desbloqueo:** el primer producto que tenga su lista de terceros cerrada. Se hace allí y
se trae a la plantilla la parte común.

### Búfer de errores tempranos para Sentry en el navegador

Dos listeners (`error`, `unhandledrejection`) que guarden los errores lanzados antes de
que termine la carga diferida del SDK y los envíen al cargarse.

**Desbloqueo:** que un producto con usuarios reales vea fallos de arranque que Sentry no
recoge.

### Workflows de producción: migraciones, drift y backups

- **Migraciones**: `workflow_dispatch` en modo dry-run por defecto; aplicar exige escribir
  una confirmación.
- **Drift contra producción**: comparar `schema.prisma` con la estructura real, solo
  lectura.
- **Backups**: el módulo `backups`.

No están en el core porque necesitan secretos de producción y decisiones de cada proyecto
(quién aprueba, retención, plan de Supabase).

**Desbloqueo:** el primer proyecto que salga a producción desde la plantilla. Se escriben
allí y se traen como módulo o como parte opcional documentada.

### `manifest.json` de los módulos y automatización de su instalación

**Desbloqueo:** que existan al menos dos o tres módulos implementados y se vea qué datos
se repiten. Antes, cualquier formato sería inventado.

### Registro de usuarios y recuperación de contraseña

Forman parte de `auth-advanced`; la recuperación se decidió dejar ahí en v1.0
([`modules/README.md`](../modules/README.md)). **Desbloqueo:** dos productos que la hayan
implementado; entonces se valora subir al core la parte común.

### Internacionalización

Módulo `i18n`, ya en el catálogo. **Desbloqueo:** un producto con dos idiomas reales.
`project.locale` y `public_docs/` ya están preparados (el árbol es el idioma por defecto).

### Reevaluar Prisma frente al drift de tipos

Desde v1.0, CI compara `database.types.ts` con las migraciones (`db:types:check`), y eso
da casi la misma garantía que `db:drift`. Prisma cuesta:

- dos `overrides` y dos entradas de `allowScripts`;
- el motor que se descarga al instalar;
- `scripts/prisma-db.mjs` y sus tests.

Y su Studio duplica el que ya levanta Supabase en local. Se mantiene congelado en v1.0.
**Desbloqueo:** el primer proyecto real. Si en él Prisma no aporta nada que no dé el
check de tipos, se retira en una versión MAJOR.

### Mantenimiento de CI

- `supabase start -x studio,realtime,storage-api,imgproxy,…` en CI para acortar el
  arranque (hoy levanta el stack completo dos veces por PR, en CI y en E2E).
- Actions fijadas por SHA en vez de por etiqueta, y Dependabot configurado teniendo en
  cuenta `allowScripts` ([STACK.md](STACK.md)).
- Notificación a Discord también en `e2e.yml` y `security.yml`.

**Desbloqueo:** la primera ejecución real en GitHub, que dirá cuánto tarda cada job y qué
versiones de las actions están vigentes.

### Pequeños ajustes de estructura

- `src/app/auth/` (route handlers) y `src/app/(auth)/` (páginas) se parecen demasiado a
  primera vista. Renombrar uno de los dos es un cambio de rutas: se hace con un motivo
  más, no solo por esto.
- `engines` admite solo Node 24. Abrirlo a Node 26 cuando sea LTS, junto con `.nvmrc` y
  CI.

### Contrato de `public_docs`: generalizar el Docusaurus

El repo de Docusaurus tiene todavía algunos supuestos de su primer producto. Se
comprobaron compilando su build real con el `public_docs/` de la plantilla (2026-09-23):
el build pasa y emite el JSON-LD de las dos páginas, pero el `llms-full.txt` generado:

- imprime `Plan mínimo: Free` en cada página y avisa en la cabecera de que «cada guía
  indica el plan mínimo», aunque el producto no tenga planes;
- enlaza una «Ficha del producto» en `https://<app>/llms.txt`, que la plantilla no sirve.

Además, su validador lleva escritas la lista de módulos y de planes del primer producto
(no afecta mientras los campos no se usen).

**Desbloqueo:** el segundo producto que se publique. El cambio se hace en
`R3ZON-Docusaurus` (imprimir el plan solo si existe `plan_minimo`; enlazar el `llms.txt`
de la app solo si el producto lo declara), no aquí. Alternativa del lado del producto:
servir un `/llms.txt` propio cuando tenga contenido público que describir.
