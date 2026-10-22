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

La plantilla no es multi-tenant (es un módulo: `multi-tenancy`). **Excelsior sí lo será**
(Fase 1): el tenant es la **empresa cliente** y el staff de R3ZON ve todos por permiso,
no por saltarse la RLS (§16). Las reglas son:

- Cada tabla de negocio lleva **`organization_id`** (en Excelsior, el tenant es la
  organización: no hay columna `tenant_id`), **rellenado por un trigger**, nunca por el
  cliente.
- La RLS filtra por pertenencia a la organización. El frontend no añade
  `.eq("organization_id", …)`.
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
servidor, que sea por seguridad, no por comodidad. **Excepción prevista en Excelsior:**
el PDF del contrato firmado se genera en el servidor, porque es una evidencia y el
cliente no puede ser quien la produce (§17). Las librerías de más de ~100 KB entran
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

---

# Excelsior: decisiones del producto

> **Previsto.** Estas secciones describen la arquitectura **planificada** para Excelsior
> ([PLAN.md](PLAN.md)). Cada una se revisa y se marca como vigente cuando su fase se
> implementa; si la implementación se aparta, se corrige aquí con el motivo.

## 15. Crecer por apartados

Excelsior crecerá con secciones nuevas que hoy no conocemos. Para que añadir una no
obligue a tocar las demás:

- Cada sección es un **módulo de negocio** con su propia carpeta de rutas
  (`src/app/(app)/<seccion>/`), sus componentes (`src/components/<seccion>/`), su lógica
  (`src/lib/<seccion>/`), sus migraciones y sus tests. Se apunta en
  [MODULES.md](MODULES.md).
- Todo lo que pertenece a un cliente cuelga de su **organización** (`organization_id`,
  rellenado por trigger) y, si es de un proyecto, de su `project_id`. Con eso, la RLS de
  una sección nueva es la misma receta que la de las anteriores.
- La **navegación** se declara en una lista (sección, ruta, icono, quién la ve), no
  escrita en el layout: añadir un apartado es añadir una entrada.
- Las piezas transversales (asistente por pasos, subida de ficheros, firma, pago,
  notificaciones, audit log) son **servicios compartidos** que las secciones usan, no
  copian.

## 16. Dos mundos con una sola verja: staff y clientes

- Un usuario de cliente solo ve filas de las organizaciones a las que pertenece.
- El staff de R3ZON ve todas, pero **por permiso** (`is_staff()` dentro de las mismas
  policies), no con `service_role` ni con RPCs que se salten la RLS. Así un fallo de una
  policy afecta igual a los dos mundos y los tests lo ven.
- Lo **interno** de R3ZON (notas internas, precio de coste, notas de tickets) va en
  tablas o columnas que la RLS o los grants niegan al cliente, con un test que lo
  intente.
- El panel `/admin` se protege en tres capas: proxy, layout y RLS. Las dos primeras son
  experiencia de usuario; la tercera es la seguridad.
- «Ver como cliente» es **solo lectura** y queda en el audit log.

## 17. Contratos: firma propia con evidencias

Firma electrónica **simple** (eIDAS) hecha en casa, con evidencias. **Pendiente de
validación jurídica** (decisión D-10 de [PLAN.md](PLAN.md)): eIDAS impide rechazar una
firma solo por ser electrónica, pero solo la cualificada equivale automáticamente a la
manuscrita. Para qué contratos basta lo decide la asesoría. El diseño técnico:

1. El contrato se genera desde una **plantilla versionada** y los datos de la
   contratación. La versión de la plantilla queda ligada al contrato.
2. El firmante ve el documento completo, acepta, firma (dibujada o tecleada) y confirma
   con un **código de un solo uso enviado a su email**.
3. El **servidor** compone el PDF final con una hoja de evidencias (identidad, fecha UTC,
   IP, agente, verificación del código, hash SHA-256 del documento) y lo guarda en un
   bucket privado.
4. El contrato firmado es **inmutable**: ningún rol de la app puede actualizarlo ni
   borrarlo (grants + trigger), y el hash guardado permite comprobar que el fichero no
   ha cambiado.
5. Copia por email al firmante y a R3ZON en el momento de la firma.

**Por qué propia y no un proveedor:** sin coste por firma, con la estética del portal y
sin sacar al cliente a otra web en el momento crítico. Si un cliente exige firma
avanzada, la generación del documento y las evidencias están separadas de «quién firma»,
para poder enchufar un proveedor sin rehacer el flujo.

## 18. Pagos: Stripe es la fuente de verdad del cobro

- La app **nunca** marca algo como pagado por una petición del cliente: solo el
  **webhook** de Stripe, con la firma verificada y deduplicado por id de evento.
- Los estados de pago contemplan los **asíncronos** (transferencia y SEPA tardan días y
  un adeudo SEPA puede devolverse después).
- Versión de la API de Stripe **fijada** en el código.
- Las claves secretas de Stripe solo en servidor ([DEVELOPMENT.md](DEVELOPMENT.md) →
  «Añadir una variable de entorno»).
- La factura legal la emite hoy Stripe y mañana ANTARES: la app guarda una
  **referencia** a la factura del emisor, no la reconstruye.

## 19. Ficheros del cliente

- Buckets **privados**; nada de URLs públicas permanentes. Descargas con URL firmada de
  corta duración.
- La ruta del objeto empieza por la organización (`<organization_id>/<project_id>/…`) y
  las policies de `storage.objects` lo comprueban contra la pertenencia del usuario.
- Límites de tipo y tamaño en servidor, no solo en el selector de ficheros.
- **Cuarentena:** todo fichero subido entra en una zona no descargable hasta pasar el
  análisis antimalware; solo entonces se mueve (o se marca) como disponible.
- **Tipo por contenido:** el MIME se comprueba en servidor leyendo los primeros bytes,
  no fiándose de la extensión ni de la cabecera del navegador.
- **Nombres normalizados:** el nombre visible se guarda aparte; la ruta del objeto es un
  identificador generado (sin `..`, sin caracteres de control, sin colisiones).
- **ZIP:** límite de tamaño descomprimido y de número de entradas (bombas de
  descompresión).
- **Metadatos:** se eliminan los EXIF de las imágenes (la ubicación de una foto hecha con
  el móvil es un dato personal que nadie ha pedido).
- **Sin credenciales:** el portal no acepta contraseñas como texto ni como documento
  (decisión T-07 de [PLAN.md](PLAN.md)).
- Los backups cubren Storage, no solo la base ([RESTAURACION.md](RESTAURACION.md)).

## 20. Estados explícitos

Invitaciones, contrataciones, contratos, pagos y proyectos tienen **máquinas de estados
explícitas**: un `enum` (o tabla de estados) por entidad, una tabla de transiciones
permitidas y un **trigger** que rechaza cualquier otra, de modo que ninguna vía de
escritura (app, RPC, webhook, panel) pueda saltarse un paso. Cada cambio de estado deja
rastro (quién, cuándo, por qué). Borrador inicial — se cierra en la Fase 2, entregable 0:

| Entidad | Estados | Caminos no felices que tienen que existir |
|---|---|---|
| Invitación | `pendiente → aceptada` | `revocada`, `caducada`; reenvío = invitación nueva que revoca la anterior |
| Contratación | `borrador → invitada → datos_completos → firmada → pago_en_curso → pagada → activa → finalizada` | `cancelada` (antes de firmar), `rescindida` (después), `en_impago` |
| Contrato | `generado → enviado → firmado` | `anulado` (antes de firmar), **`sustituido`** por otro contrato (anexo o nueva versión): el firmado no cambia, se enlaza el que lo sustituye |
| Pago | `pendiente → en_curso → pagado` | `fallido`, **`devuelto`** (adeudo SEPA rechazado días después), **`en_disputa`** (y su resolución), **`reembolsado`** total o parcial; cada reembolso o devolución con su **abono / factura rectificativa** |
| Proyecto | `briefing → diseño → desarrollo → revisión → lanzado → mantenimiento` | `en_pausa` (p. ej. por impago), `cancelado` |

Reglas:

- Stripe **no entrega los eventos en orden** y puede repetirlos: el webhook aplica una
  transición solo si es válida desde el estado actual, y un evento antiguo nunca hace
  retroceder un estado.
- Los estados de pago y contratación están relacionados pero no son el mismo: un pago
  devuelto lleva la contratación a `en_impago`, no la «desfirma».
- La interfaz se deriva del estado (qué botones aparecen), nunca al revés.
