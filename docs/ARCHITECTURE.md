# Arquitectura: principios y su origen

Estos principios son el núcleo de la plantilla. Casi todos proceden de problemas reales
encontrados durante el desarrollo de **R3ZON ANTARES**, el primer producto de R3ZON; se
cita el origen para que quien venga después sepa qué evita cada regla y pueda juzgar si
sigue aplicando.

Las reglas operativas derivadas (qué hacer al escribir código) están en
[`CLAUDE.md`](../CLAUDE.md). Aquí está el porqué.

---

## 1. El esquema vive en un único sitio

`supabase/migrations/` es la única fuente del esquema. No hay `schema.sql`, ni scripts de
«setup para entornos nuevos», ni Prisma Migrate.

**Origen.** En ANTARES convivieron durante un tiempo las migraciones y un fichero de
setup. Divergieron en silencio, y el día que un `db reset` local dejó de parecerse a
producción nadie lo supo hasta desplegar.

## 2. Una migración aplicada no se edita

**Origen.** La migración inicial de ANTARES se editó después de aplicarse en producción.
Lo añadido solo existía en bases creadas desde cero; producción nunca lo tuvo, y tres
`db push` fallaron el mismo día. Un `db reset` local no puede detectarlo: en local se
ejecuta el fichero nuevo, en remoto se ejecutó el viejo.

## 3. La base de datos es la verja

- **RLS en todas las tablas.** El frontend no filtra por usuario ni por tenant: usa el
  cliente de Supabase con la sesión, y la RLS decide qué filas existen para él.
- **Grants mínimos y explícitos.** Supabase concede todo a `anon` y `authenticated` por
  defecto; la RLS filtra filas, pero los grants deciden qué operaciones existen.
- **Las reglas de negocio van en triggers sobre la tabla**, no en guardas dentro de cada
  RPC ni en el cliente.

**Origen.** Las policies RLS **no se aplican dentro de una función `SECURITY DEFINER`**.
En ANTARES, guardas escritas dentro de RPCs dejaron fuera las rutas de escritura que
alguien olvidó, y hubo que cerrar una fuga entre tenants en una RPC. Anclada a la tabla,
la regla cubre toda vía de escritura presente y futura. Lo que hace el cliente
(deshabilitar un botón, un paywall) es experiencia de usuario: avisar antes de chocar.

**Cómo se vigila.** [`tests/db/security-catalog.test.ts`](../tests/db/security-catalog.test.ts)
recorre el catálogo de Postgres y falla si aparece una tabla sin RLS, un grant a `anon`,
una `SECURITY DEFINER` ejecutable por quien no debe o sin `search_path`, o una FK sin
índice. Prueba las tablas que existan hoy y las que añada cualquier módulo mañana.

## 4. Nada se ejecuta porque sí

La migración core retira el `EXECUTE` por defecto de `PUBLIC` y `anon` sobre las
funciones nuevas. Una RPC pública se concede de forma explícita y se justifica.

**Origen.** La clase de fallo más repetida en ANTARES fue una función `SECURITY DEFINER`
ejecutable por `anon`: hubo varias migraciones de «revocar anon» a posteriori, cada una
tras una auditoría. En la plantilla se corta de raíz y un test lo vigila.

## 5. Aislamiento por tenant (cuando lo haya)

La plantilla no es multi-tenant (es un módulo: `multi-tenancy`). Cuando un producto lo
sea, las reglas son:

- Cada tabla de negocio lleva `tenant_id`, **rellenado por un trigger**, nunca por el
  cliente.
- La RLS filtra por pertenencia al tenant. El frontend no añade `.eq("tenant_id", …)`.
- Los tests de BD prueban que un tenant no ve ni modifica lo de otro.

## 6. Roles en dimensiones desacopladas

Nivel de plataforma × permisos dentro del tenant × plan de suscripción. Detalle en
[ROLES.md](ROLES.md).

**Origen.** Meterlo todo en un solo enum obliga a combinar estados que no tienen que ver
entre sí (un plan no es un permiso), y se acaba pagando en cada `if`.

## 7. Rutas públicas en una lista explícita

[`src/lib/public-paths.ts`](../src/lib/public-paths.ts) es la única fuente de «qué se ve
sin sesión». Todo lo demás exige sesión. La comparación es por segmento.

**Origen.** En ANTARES, `startsWith` a secas dejó pasar `/preciosXYZ` como pública, y
tres rutas que debían ser públicas (imágenes Open Graph, un honeypot) cayeron detrás del
login sin que ningún test lo notara. De ahí la comprobación con `curl` sin cookie de
[`CLAUDE.md`](../CLAUDE.md) §10.

## 8. Coste de servidor tendiendo a cero

Lo pesado (PDF, imágenes, ZIP, OCR) corre en el navegador. Si algo tiene que correr en el
servidor, que sea por seguridad, no por comodidad. Las librerías de más de ~100 KB entran
con `dynamic(() => import(…), { ssr: false })`.

## 9. Fechas públicas a mano

`last_update.date` de `public_docs/` y el `lastModified` de `sitemap.ts` son literales,
actualizados a mano en el mismo commit que el cambio. Nunca `new Date()` ni la fecha de
git.

**Origen.** Una fecha que se mueve sola en cada despliegue (o en cada sincronización del
árbol) hace que el buscador ignore la señal. Y en ANTARES se vio el otro lado: 46 de 182
páginas decían dos fechas distintas de sí mismas cuando la fecha estaba duplicada. Por eso
aquí solo hay una: la del frontmatter.

## 10. Los tests de seguridad no pueden pasar en silencio

Un test de BD sin base **falla en CI**. En local se salta con un aviso visible.

**Origen.** En ANTARES, la única suite que probaba RLS, triggers y grants se saltaba sola
cuando no encontraba Postgres, y en CI nunca lo encontraba. Estuvo en verde meses sin
ejecutarse. Una suite que se salta sola no protege nada y encima da tranquilidad.

## 11. CI también en las ramas largas

**Origen.** Una rama de feature de ANTARES vivió semanas sin CI. Tres regresiones de una
función crítica, una de ellas bloqueante, convivieron dos días sin que nada las viera.

## 12. Documentar es parte de terminar

La bitácora, las tareas y los documentos se actualizan en la misma tarea que el código.

**Origen.** Seis commits sin documentar en ANTARES dejaron los documentos describiendo un
estado que ya no existía. Y un fichero de tareas que guardaba reglas («comprobar X de vez
en cuando») acumuló «tareas» que no se podían cerrar nunca: por eso las reglas van a
`CLAUDE.md` y las tareas solo son tareas.

## 13. Core pequeño, módulos opcionales

Lo que usan todos los productos es core; lo que usan algunos es módulo
([`modules/README.md`](../modules/README.md)). La plantilla se optimiza para el quinto
producto de R3ZON, no para el primero.

## 14. Sin sobrearquitectura

Nada de sistema de plugins, CLI, paquetes npm internos, monorepo ni generador de
proyectos hasta que copiar a mano sea un problema real y repetido. La estructura actual
permite evolucionar hacia eso sin rehacer nada: los módulos ya tienen un contrato y una
forma de carpeta.
