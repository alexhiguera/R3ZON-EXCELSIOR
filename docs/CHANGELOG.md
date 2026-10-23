# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

---

### Iteración 9 — *2026-10-23* — Condiciones económicas antes de invitar, en céntimos exactos

Requisito de R3ZON: antes de invitar, el equipo fija qué servicios contrata el cliente
(uno o varios, del catálogo o a medida, con categoría ampliable), su precio, descuento e
IVA, el total y cómo se paga; el cliente ve esas cifras, no puede cambiarlas y solo paga
lo que la base autoriza. Decisiones de R3ZON (T-34 a T-38): IVA por tipo sobre la suma
de bases, descuentos por línea (% o importe), revisiones que acepta el cliente (firmando
un contrato nuevo si ya firmó) e hitos de pago libres.

- **Céntimos y una sola política de redondeo** (ARCHITECTURE §18). Ya se guardaba todo en
  céntimos, pero el redondeo estaba repartido (cada consulta hacía su `round`). Ahora vive
  en un módulo base (`money_percent`, `money_split`, `format_eur`): un redondeo por
  porcentaje, medio céntimo hacia arriba; IVA una vez por tipo; reparto de hitos con los
  céntimos sobrantes en los últimos (1.000 € en 3 = 333,33 + 333,33 + 333,34). Le
  expliqué a R3ZON que trabajar en céntimos no elimina el redondeo de un porcentaje (21 %
  de 10,50 € = 220,5 céntimos): lo que se garantiza es que ocurra una vez y con una regla.
- **Condiciones por revisiones** (línea base reescrita, T-18): la contratación pierde
  precio, condiciones y modalidad; las condiciones van en `engagement_revisions` con sus
  líneas (`engagement_lines`) e hitos (`engagement_milestones`). Un trigger recalcula y
  **guarda** bases, desglose de IVA, total e importes de los hitos; nadie más puede
  escribir esas columnas. Al dar sus datos, el cliente acepta la revisión 1 y queda
  inmutable. Descartado calcular los totales en una vista: un cambio futuro de la
  fórmula recalcularía en silencio lo ya aceptado.
- **Cambios**: revisión nueva (copia), que el equipo edita y propone; el cliente la
  acepta en el portal o, con contrato firmado, firmando el contrato nuevo, que se compone
  con la revisión propuesta y deja el anterior como «sustituido». El contrato firmado
  guarda la revisión que cubre (`contracts.revision_id`). Aceptar solo pasa dentro de las
  funciones del cliente: el equipo no puede aceptar por él (lo comprueba un test).
- **Hitos libres** sustituyen a pago único / señal + entrega (T-31): importe fijo o peso;
  R3ZON los libera de uno en uno (`released_milestones`, con control de concurrencia por
  el valor visto, para que un doble clic no libere dos). `amount_due_now` = hitos
  liberados − cobrado: es el único importe que usará Stripe.
- **Catálogo como plantilla**: categorías en tabla (8 de partida; admin añade más), sin
  modalidades ni señal; el IVA viaja como texto exacto. El cliente ya no lee el catálogo:
  todo lo que ve está copiado en sus líneas.
- Contrato: huecos nuevos `servicios.detalle`, `precio.descuento`, `pago.hitos`,
  `contrato.revision`; quitados los que dependían de un único servicio.
- App: `src/lib/dinero.ts` (texto ↔ céntimos con BigInt; antes `euros()` dividía entre
  100 en coma flotante para formatear); sección «Condiciones económicas» en la
  contratación (servicios, descuentos, pagos, revisión del total y cambios); la
  invitación enseña lo que verá el cliente; bienvenida y pago del cliente con el desglose;
  página para aceptar un cambio. La «Nueva contratación» ya no obliga a elegir un servicio
  del catálogo: lo cazó el E2E, que creaba la contratación con el primero de la lista.
- Tests: `tests/unit/dinero.test.ts` (conversión exacta, también casos que en coma
  flotante pierden un céntimo: 0,29 y 1,13), `tests/db/contrataciones-condiciones.test.ts`
  (redondeo, IVA por tipo, descuentos, hitos, pagos parciales, importes elevados,
  manipulación por el cliente y por el equipo, revisiones), sustitución de contrato
  firmado, categorías, y E2E `condiciones.spec.ts` de punta a punta.
- Errores del camino: un `sed` de un script anterior se llevó medio paso de pago; el
  mensaje de un precio negativo decía «el descuento supera el precio» (ahora lo dice
  claro); un test ordenaba dos contratos por `created_at` dentro de la misma transacción
  (mismo instante): fallaba una de cada dos veces. Desempate por `id` (UUIDv7) en el test
  y en `contratoDe`. En un borrador llegué a convertir céntimos a euros con `/ 100` para
  reenviarlos: corregido antes de ejecutarlo, ahora viajan en céntimos.
- Pendiente: confirmar con ANTARES que redondea igual (TAREAS).

### Iteración 8 — *2026-10-23* — Modalidad de pago, señal + entrega y Fase 5: proyecto y briefing

R3ZON decide (2026-10-23): pago **embebido** con Stripe, aparcado hasta tener cuenta de
pruebas (T-30, era D-04); la **modalidad la fija R3ZON** al crear la contratación (T-31,
cambia T-05); el **proyecto nace al completar el alta** (T-32); la **subida de ficheros
se aplaza** y el briefing empieza sin ellos (T-33).

**Fase 4: modalidad y señal + entrega**

- `engagements.payment_plan`, sin default: lo pone el trigger con la primera modalidad
  de la versión del servicio y rechaza las que el servicio no admite. Va al contrato, así
  que solo cambia en borrador o invitada, como el precio. El hueco `precio.modalidades`
  (lista de las ofrecidas) pasa a `precio.modalidad` (la elegida, con la señal y el resto
  en euros): con la elección en R3ZON, la lista ya no decía lo contratado.
- `delivered_at` + trigger: solo con señal + entrega, con los datos dados, una vez, con la
  hora de la base, sin desmarcar, auditado. La vista de cobros calcula `deposit_cents` y
  `due_now_cents` (la señal hasta la entrega, después el saldo); `amount_due_now` solo la
  lee. Descartado guardar «fase de cobro»: se deriva de `delivered_at`.
- Panel: modalidad en los interruptores y botón **Marcar entrega** en el cobro. El
  cliente ve «ahora toca la señal».

**Fase 5: proyecto y briefing (sin ficheros)**

- Módulo `proyectos` (`20261023000900_proyectos.sql`): plantilla de briefing por servicio
  (solo admin) que se **copia** al proyecto al nacer, para que editarla no cambie
  proyectos en marcha; `projects` con su máquina de estados; elementos de briefing con
  tipos `texto`, `color`, `tipografia`, `enlace`. No hay tipo para accesos (T-07) ni,
  todavía, para ficheros (T-33).
- El proyecto lo crea un trigger `SECURITY DEFINER` sobre `engagements` (nadie puede
  crearlo a mano): al pasar a `firmada`, a `activa`, o a `datos_completos` sin firma en el
  portal (también si R3ZON quita la firma después). Idempotente.
- Quién escribe qué lo decide el trigger del briefing, no la app: el cliente aporta, deja
  para más tarde o marca «no aplica» (solo lo opcional); R3ZON valida lo aportado o pide
  cambios con nota obligatoria; lo validado el cliente ya no lo toca; un proyecto
  cancelado congela el briefing. Escriben propietario y miembros; facturación solo lee
  (RLS). El color se normaliza a minúsculas y el enlace tiene que ser `http(s)` (un
  `javascript:` no entra). El registro de actividad guarda el cambio de estado, no el
  contenido.
- Páginas: `/proyectos` y `/proyectos/[id]` (cliente), `/admin/proyectos` y su ficha
  (revisión y estado), plantilla en la ficha del servicio; el inicio, «ver como cliente»
  y el paso «Listo» enlazan al briefing.
- Tests: modalidad y señal (BD), `tests/db/proyectos.test.ts` (nacimiento,
  compartimentación, permisos por rol, validación, máquina de estados con paridad
  interfaz-base), unitarios, y E2E `proyectos.spec.ts` (plantilla → alta → briefing →
  cambios → validación → diseño).

**Errores del camino**

- `next.config.ts` importaba `withSentryConfig` de `@sentry/nextjs`, que en Sentry 11 ya
  no lo exporta (está en `@sentry/nextjs/config`). Venía de la actualización de
  dependencias y no se notaba: el typecheck incremental lo tenía en caché y la función
  solo se llama con DSN. Corregido el import.
- Al tener el cliente dos secciones (Inicio y Proyectos) apareció la barra inferior del
  móvil, con el mismo `aria-label` que la lateral: axe lo marca (`landmark-unique`).
  Etiqueta propia para la barra inferior. Es **core**: se propone para la plantilla.
- El primer E2E del briefing buscaba el texto exacto de un elemento de la plantilla, que
  comparte nodo con sus insignias; se busca por la fila.

### Iteración 7 — *2026-10-23* — Cobros: estado económico separado, interruptores y cobros externos

R3ZON trae un informe de pagos: hay clientes que **ya pagaron fuera** (transferencia) sin
haber firmado, y otros al revés. Con el flujo fijo «firma → pago» de la Fase 3 se les
pediría firmar o pagar dos veces. Decisiones de R3ZON: la activación la hace el equipo a
mano (T-26); el equipo decide por contratación si el cliente firma y si paga en el
portal (T-27); **sin efectivo** (T-28); la factura la emite **ANTARES con TicketBAI**,
probablemente escuchando a Stripe desde ANTARES (T-29, sustituye a T-06 y cierra D-11).

- **La contratación pierde sus estados de pago** (`pago_en_curso`, `pagada`,
  `en_impago`). Mezclar los dos ejes obligaba a inventar combinaciones («pagada pero sin
  firmar») como estados nuevos. El estado económico se **calcula** en la vista
  `engagement_collections` a partir del libro de cobros; no se guarda, para que no pueda
  contradecir al libro. Descartado: una columna `collection_status` mantenida por
  trigger (otro sitio donde puede divergir).
- **Interruptores** `requires_signature` y `requires_payment` (línea base reescrita,
  T-18). Sin firma, `datos_completos → activa` es válida y `→ firmada` no; la firma se
  puede cambiar solo hasta firmarse. Se pueden fijar al crear la contratación sin invitar
  (nueva sección en la ficha) o al invitar; `invite_engagement()` re-invita revocando la
  invitación anterior (escenario 9: nunca dos enlaces vivos para la misma alta).
- **Libro de cobros** (`payments`, migración `20261023000800_cobros.sql`): céntimos, IVA
  incluido, inmutable (se anula con motivo; facturado, ni eso: se rectifica en
  ANTARES), sin `DELETE`, auditado sin copiar las referencias que escribe el equipo. El
  trigger de alta **bloquea la fila de la contratación** (`FOR UPDATE`) antes de sumar:
  sin el bloqueo, dos registros simultáneos pasaban los dos el control del total (lo
  prueba un test con dos conexiones). Los cobros `stripe` solo los crea
  `service_role`/`postgres`, con `provider_reference` única: la idempotencia del webhook
  queda impuesta antes de escribirlo.
- `amount_due_now()` decide qué se le pide al cliente (0 si no paga en el portal, si
  está en revisión o con un cobro pendiente): cuando llegue Stripe, el importe no saldrá
  nunca de la página.
- **Asistente condicional**: `pasosAlta()` (pura, con tests) decide los pasos; el nuevo
  paso de pago muestra total, pagado y pendiente, sin cobrar todavía («el equipo te
  indicará cómo»). «Listo» ya no dice «contrato firmado» si no lo hubo. El inicio del
  cliente y el panel muestran el estado de cobro.
- Panel: sección de alta (invitar, interruptores, activar con aviso de saldo) y de cobro
  (resumen, movimientos, registrar, anular, facturado, revisión) en la contratación.
- Tests: `tests/db/cobros.test.ts` con los escenarios 1–10 del informe, autorización
  entre empresas, idempotencia, auditoría y concurrencia; E2E `cobros.spec.ts` (cliente
  ya pagado en dos transferencias y sin firma: entra, da sus datos y termina sin firmar
  ni pagar; un cobro de más lo rechaza la base); `onboarding.spec.ts` pasa ahora por el
  paso de pago.
- Errores del camino: un test de inserción del cliente esperaba un rechazo de la RLS y
  lo da el trigger («la contratación no existe», porque con RLS no la ve), y otro
  esperaba error en una actualización que no cambiaba nada. Corregidos los dos tests, no
  el código: el comportamiento era el correcto.
- Pendiente: Stripe (cuenta de pruebas y D-04), contrato con ANTARES (D-06), señal +
  entrega y pago delegado.

### Iteración 6 — *2026-10-23* — Cierre de la Fase 2 y Fase 3: alta, contrato y firma

R3ZON decide: «ver como cliente» de solo lectura (T-22), las dos vías de alta de
cliente, firma delegada (T-25), firma dibujada con código por email y, en vez de un
texto de contrato fijo, una **herramienta para el equipo** con plantillas, cláusulas
activables y anexos (T-23).

**Fase 2 (cierre)**

- `create_client_with_invitation()`: cliente e invitación, con o sin servicio, en una
  transacción. La vía de crear primero e invitar después se mantiene.
- «Ver como cliente»: no suplanta. Usa los mismos componentes que el inicio del cliente
  (`ResumenContrataciones`) con los permisos del staff, sin enlaces de acción, y cada
  apertura queda en el registro (`log_client_view`).

**Fase 3**

- Datos fiscales (`organization_billing`) con validación de NIF, NIE y CIF (carácter de
  control) en la app, y formato en la base.
- Módulo `contratos`: plantillas y cláusulas versionadas e inmutables, con una lista
  cerrada de huecos que la base comprueba al guardar (y un test de paridad con la de la
  interfaz); contrato por contratación con cláusulas activadas y anexos editables solo
  en borrador; máquina de estados `borrador ⇄ enviado → firmado`, anulado y sustituido.
- **El texto lo compone la base** (`contract_render`): la vista previa y lo firmado salen
  de la misma función. Descartado componerlo en TypeScript y mandarlo a la base: el
  cliente podría mandar otro texto.
- **Firma** (`sign_contract`): propietario, contrato enviado, datos confirmados,
  aceptación, firma dibujada (PNG comprobado) y **código de email verificado en la
  sesión en los últimos 10 minutos, leído del claim `amr` del JWT**. Guarda el texto, su
  SHA-256 (calculado por la base), las evidencias (incluidas IP y agente que ve
  PostgREST) y pasa la contratación a `firmada`. Lo firmado es inmutable para todos.
- PDF con `pdf-lib`, generado al descargar desde el texto firmado, con hoja de
  evidencias. Es una representación: la evidencia es el texto y su huella en la base.
- Asistente `/bienvenida/[id]` (bienvenida, datos, contrato y firma, enhorabuena) en el
  que el paso lo decide el estado real; delegación de firma; inicio del cliente con sus
  servicios y el siguiente paso.
- Plantilla de email del código (`supabase/templates/codigo.html`) y límite local de
  inicios de sesión subido a 100 para los E2E (en Cloud, el de por defecto).

**Fallos cazados por los tests**, todos corregidos:

- React 19 **vacía el formulario tras cada envío con `action`**, también si la acción
  devuelve un error: un CIF mal escrito borraba todo. `FormAccion` envía ahora por
  `onSubmit` + `startTransition` y solo vacía si sale bien (con test). Los formularios de
  acceso tienen el mismo problema: tarea abierta.
- `upsert` de PostgREST hace `ON CONFLICT DO UPDATE` de todas las columnas, incluida la
  que no tiene permiso de UPDATE: el propietario no podía guardar sus datos. Ahora se
  actualiza y, si no había fila, se inserta.
- La ficha del panel mostraba un contrato **firmado recompuesto ahora** (con el hueco del
  firmante vacío) en vez del texto firmado.
- Un `id` propio en un campo pisaba el de `<Field>` y dejaba el campo sin etiqueta
  accesible.
- En la migración, otra vez el patrón `tg_table_name = … AND new.campo`: corregido antes
  de ejecutarse.

**Pendiente**: validación jurídica (D-10) antes de firmar nada real, textos reales
(D-05), email del contrato (T-17), VIES. La elección de la modalidad de pago pasa a la
Fase 4, con el cobro.

### Iteración 5 — *2026-10-23* — Dependencias al día, línea base modular, seguridad y RGPD, y Fase 2

R3ZON aprueba T-15, aparca lo pendiente de la Fase 1 y pide cuatro cosas antes de
seguir: dependencias en su última estable, UUIDv7 «bien desde el principio» y sin
migraciones que parcheen migraciones, una app modular que no colapse por un módulo, y
una revisión de la compartimentación de datos al nivel industrial y del RGPD (con
conservación de 6 años, backups y exportación e importación). Después, Fase 2.

**Dependencias**

- Todo a la última estable: Next 16.4, React 19.3.1, Sentry 11, supabase-js 2.118, Biome
  2.6, Playwright 1.64, CLI de Supabase 2.121, Prisma 7.10.1. Node 24.22.1 (LTS).
- **No** se subió: Node 26 (no es LTS), Prisma 8 (RC), `@types/node` 26 (no casa con el
  runtime) ni Postgres 18 (Supabase no lo ofrece: la CLI rechaza `major_version = 18`).
- Sentry 11 ya no usa `@sentry/cli`: su aprobación de `allowScripts` desaparece. Prisma
  7.10.1 se volvió a aprobar tras revisar sus scripts (iguales).
- Biome 2.6 formateaba el Markdown y estropeó 19 documentos (quitaba la línea antes de
  las listas, realineaba tablas). Se deshizo y el Markdown sale de Biome.
- Nuevo `server-only`.

**Base de datos: línea base modular (T-18) y UUIDv7**

- Las dos migraciones de la iteración 4 se reescriben como seis ficheros, uno por
  módulo. Se puede porque no existe ningún entorno compartido; desde el primer `db push`
  vuelve la regla estricta (CLAUDE.md §4).
- UUIDv7 con el método de Postgres 18 (fracción de milisegundo en 12 bits). La primera
  versión solo llevaba milisegundos y un test de actividad salió desordenado: dos filas
  del mismo milisegundo. Es definitiva: no habrá que migrar al llegar Postgres 18.

**Seguridad y RGPD** (detalle en `auditoria.md`, Auditoría 1, y en el nuevo `RGPD.md`)

- Revisión sobre el catálogo real de Postgres, no sobre el código. Cerrados: emails en el
  registro de actividad (A1-1), registro modificable por `postgres`/`service_role`
  (A1-2), actor perdido al suprimir un usuario (A1-3), riesgo de borrado en cascada de
  datos con obligación de conservación (A1-4), contraseña de 8 (A1-5, ahora 12: T-19),
  invitaciones de validez arbitraria (A1-6), funciones de trigger ejecutables (A1-9).
- Conservación de 6 años desde el esquema: organizaciones archivables, contrataciones con
  `on delete restrict` y sin `DELETE`, registros inmutables con purga solo de lo que
  pase de 6 años, purga de invitaciones cerradas (minimización).
- Dos reglas nuevas en el catálogo: toda tabla con RLS tiene policies, y solo los datos
  de acceso se borran en cascada con la organización.
- Abiertos con su plan: 2FA del equipo (A1-10, el más importante), CSP y el módulo
  `rgpd` (exportación e importación).

**Modularidad (T-20, ARCHITECTURE §21)**

- `src/modulos/<modulo>/` con `index.ts` y `servidor.ts` como únicas puertas, registro
  único, y un test que falla si un módulo usa las tripas de otro.
- Las consultas no lanzan (`src/lib/datos.ts`); cada bloque va en `ModuloSeguro`
  (límite de error + Suspense), con test de que un bloque roto no tumba a sus vecinos;
  `(app)/error.tsx` conserva la navegación.
- Descartado `loading.tsx` en la zona con sesión: con él, el 404 del panel salía con
  estado 200 (lo cazó un E2E).

**Fase 2: panel de R3ZON**

- Módulos `servicios` (catálogo con versiones inmutables; solo admin) y
  `contrataciones` (máquina de estados completa con caminos no felices, historial
  inmutable con motivo, `invite_to_service()` en una transacción).
- `/admin/clientes` (listado, búsqueda, filtro, alta, ficha, archivo, invitación con o
  sin servicio y enlace para copiar), `/admin/servicios` y `/admin/contrataciones`
  (embudo y cierre con motivo). El equipo ve el email de los miembros con
  `organization_directory()`, que comprueba dentro que es staff (el email no se duplica).
- Fallos cazados por tests: un CHECK que se evaluaba a `NULL` y dejaba pasar una señal
  vacía; una referencia ambigua en una policy (`id` resolvía a la tabla equivocada)
  que se corrigió antes de que llegara a probarse.
- Pendiente: «ver como cliente» (D-14), crear el cliente al vuelo y el envío por email.
- **Sin anunciar a usuarios** (`CLAUDE.md` §8): no hay usuarios ni `whats-new`.

### Iteración 4 — *2026-10-23* — Fase 1: empresas, roles, alta solo por invitación y UUIDv7

R3ZON decide trabajar solo en local por ahora (T-17) y pide UUIDv7 para la base (T-16).
Se construye el núcleo de la Fase 1: quién es quién y cómo se entra.

- **UUIDv7.** Postgres 17 no la trae y Supabase no tiene extensión: `public.uuidv7()` en
  SQL, con el nombre de la nativa de Postgres 18 para cambiarla por una migración el día
  que llegue. Default de toda PK nueva; el test de catálogo falla si una PK UUID usa otro.
  Comprobado que la regla salta con una tabla de prueba con `gen_random_uuid()`.
- **Modelo** (migración `organizations_invitations`): nivel de plataforma en `profiles`
  (client · staff · admin), empresas, miembros N:M con rol, invitaciones con hash y
  transiciones en trigger, registro de actividad escrito solo por triggers.
- **Prototipo de invitación + Google, y cambio de diseño (T-15).** El plan pedía que el
  token sobreviviera al viaje de OAuth. No hace falta: el hook `before_user_created`
  recibe el email que Google ya ha verificado; con contraseña, el token va en los
  metadatos del alta y el hook comprueba que es de ese email. La aceptación va en un
  trigger de `auth.users`, en la misma transacción que el alta. Descartado: que la
  página consultara la invitación sin sesión (exigiría una función ejecutable por
  `anon`, que el catálogo prohíbe con razón; la página explica qué hacer si el alta
  falla).
- **Fallo propio cazado por el E2E**: el token se quedaba guardado en
  `raw_user_meta_data` y en `auth.identities` tras un alta real. El trigger solo cubría
  el INSERT en `auth.users`, y el test de BD (que inserta a mano) daba verde. Ahora se
  limpia en INSERT y UPDATE de las dos tablas, y un E2E lo comprueba contra el Auth real.
  Al corregirlo se introdujo otro: `tg_table_name = … and new.identity_data …` en
  PL/pgSQL no se evalúa en orden y rompía todas las altas; se reescribió con IF
  anidados. La migración se corrigió en su fichero porque solo existía en local.
- **Tests de BD que asumían una base vacía**: tras los E2E, varios contaban «todas» las
  filas o hacían `UPDATE` sin `WHERE`. Ahora cada consulta se acota a sus datos; la regla
  queda en DATABASE.md.
- **App**: `/invitacion/[token]` (crear cuenta o aceptar con la cuenta actual), botón de
  Google detrás de `NEXT_PUBLIC_AUTH_GOOGLE`, callback que trata el rechazo de OAuth, la
  navegación según el nivel, el inicio con las empresas del usuario y scripts
  `dev:invitar` y `dev:staff`. `/invitacion` añadida a las rutas públicas.
- **Tests**: 150 de Vitest (47 de BD) y 30 E2E. Entre ellos, un alta directa contra la API
  de Auth sin invitación da 403.
- **Documentación pública**: nueva guía «Crear tu cuenta» y corregida «Iniciar sesión»,
  que situaba «Cerrar sesión» arriba a la derecha desde antes del armazón nuevo.
- **Sin anunciar al usuario** (`CLAUDE.md` §8): el módulo `whats-new` no está instalado
  y no hay usuarios.

### Iteración 3 — *2026-10-22* — Fase 0: identidad, marca de r3zon.com y armazón responsive

Primer bloque de código de Excelsior. El repositorio deja de ser la plantilla y la
interfaz se ve como r3zon.com en móvil, tablet y escritorio.

- **Decisiones** D-01, D-02, D-03 y D-09 cerradas con R3ZON y pasadas a T-10 a T-13:
  «R3ZON Clientes», invitación atada al email (también con Google), `admin` + `staff`,
  y usuarios en varias empresas con selector.
- **Identidad** según `TEMPLATE.md`: `project.ts`, `package.json`, `config.toml`
  (`project_id = "excelsior"`, puertos **5542x**), `.env.example`, `_meta/` e
  `index.md`. `docs:validar` y los tests de derivación pasan.
- **Marca**: tokens extraídos del CSS publicado en r3zon.com (no inventados): tinta
  `#05010f`, magenta `#e549ff` para la acción principal con su resplandor, rosa
  `#ff9ffc` para el foco, Inter y Sora vía `next/font` (servidas desde nuestro dominio).
  Logotipo e icono copiados de la web y revisados (solo trazados, sin scripts); el logo
  se genera desde el SVG original para no transcribir trazados a mano: la primera
  versión transcrita tenía erratas. **Solo modo oscuro** (T-14): la web no tiene tema
  claro y el portal es la misma marca.
- **Armazón**: navegación declarada en `src/config/navegacion.ts` (añadir un apartado es
  añadir una entrada; un test exige que cada entrada exista como página), barra lateral
  en escritorio, cabecera + barra inferior en móvil (solo con dos o más secciones),
  enlace «Saltar al contenido». Login sin «Crear cuenta», con el aviso de que las
  cuentas llegan por invitación. `Card`, `Badge` y `Stepper` con jest-axe.
- **Error propio corregido antes de probar**: `NavLinks` (cliente) recibía las entradas
  con su icono desde el servidor; un componente es una función y no cruza esa frontera.
  Ahora recibe la audiencia y lee la lista él mismo.
- **E2E en escritorio y móvil** (Pixel 7), con un solo worker: el logout llama a
  `signOut()` sin `scope`, que cierra todas las sesiones del usuario, y en paralelo un
  proyecto tumbaba la sesión del otro. Abierta la tarea de decidir el `scope`.
- **Dependencias**: `npm audit` daba 7 vulnerabilidades nuevas desde la plantilla (una
  crítica en `next` < 16.3.8). `npm audit fix` dentro de los rangos (`next` 16.4.2) y
  `vitest` + `@vitest/coverage-v8` a 5.0.5 juntos (el segundo fija la versión exacta del
  primero, por eso `audit fix` no podía). 0 vulnerabilidades; sin scripts de instalación
  nuevos sin aprobar.
- **Aplazado con motivo**: `Dialog`, `Toast`, `Tabs` y `Dropzone` se construyen en la
  fase que los use por primera vez; un componente sin pantalla se diseña a ciegas.
- **Comprobado sin cookie** (`CLAUDE.md` §10) contra el build de producción: `/`,
  `/login`, `/api/health`, `/robots.txt` e `/icon.svg` → 200; `/inicio` y `/admin` → 307
  al login.
- **Fallo de proceso**: para arrancar el servidor de prueba se cargó `.env.local` con
  `grep`, contra `CLAUDE.md` §5 (no hacía falta: Next lo lee solo). No se mostró ningún
  valor; no se repite.

### Iteración 2 — *2026-10-22* — Revisión del plan antes de desarrollar

Revisión externa del plan (Codex) aplicada antes de escribir código. Casi todo eran
contradicciones o huecos que habrían salido caros con migraciones encima.

- **Contradicciones corregidas.** La Fase 0 exigía cerrar D-01 a D-06, aunque D-04 a
  D-06 bloquean fases posteriores: ahora D-01, D-02, D-03 y D-09. `tenant_id` frente a
  `organization_id`: se fija `organization_id` en todo el proyecto (T-08). El briefing
  tenía un tipo «acceso» mientras la bóveda cifrada era una mejora futura: se quita el
  tipo y el portal no recoge credenciales hasta que exista la bóveda (T-07). Se descartó
  meter la bóveda en el MVP: es una pieza sensible con su propia revisión de seguridad
  y el MVP no la necesita.
- **Firma y facturas dejan de darse por buenas.** La firma simple propia sigue siendo la
  solución técnica, pero su suficiencia la decide la asesoría (D-10, bloquea la Fase 3);
  el plan ya no dice «suficiente». La validación fiscal de Stripe Invoicing se adelanta al
  **principio** de la Fase 4 (D-11).
- **Añadido:** prototipo de invitación + Google al empezar la Fase 1; máquinas de
  estados completas, con devoluciones, disputas, reembolsos, abonos y contratos
  sustituidos (ARCHITECTURE §20, R-06); firmante y pagador distintos de quien abre la
  invitación (D-12); ciclo de vida y retención de datos en el hito MVP (D-13); seguridad
  de ficheros (cuarentena, MIME por contenido, ZIP, EXIF); y el **Hito V**, recorrido
  vertical con un solo caso real antes de generalizar las fases 2–5 (T-09).
- **`supabase/config.toml`:** el comentario de `auto_expose_new_tables` describía el
  comportamiento antiguo. Supabase dejó de exponer las tablas nuevas sin `GRANT`
  explícito (proyectos nuevos desde 2026-05-30; los existentes, desde 2026-10-30, y el
  flag se retira). Solo se corrige el comentario: las migraciones ya conceden los grants
  de forma explícita, y fijar a mano un flag que se va a retirar podría romper el arranque
  con una CLI futura. Es core: se propone también a la plantilla.
- **Finales de línea:** comprobado que ningún fichero de `docs/` tiene CRLF en el árbol;
  `.gitattributes` ya fuerza LF al hacer commit.

### Iteración 1 — *2026-10-22* — Proyecto creado desde R3ZON Template v1.0.0

Excelsior nace de la plantilla de R3ZON (`r3zon-template.json` 1.0.0) para ser el área
de clientes de r3zon.com (`clientes.r3zon.com`). Esta iteración solo adapta la
documentación y define el producto y el plan; **el código sigue siendo el de la
plantilla** y la identidad (`project.ts`, puertos, `_meta/`) se personaliza en la Fase 0.

- Nuevos [`PRODUCTO.md`](PRODUCTO.md) (qué y por qué: problema, usuarios, glosario, flujo
  de invitación → contrato → pago → briefing, mapa de secciones, fuera de alcance) y
  [`PLAN.md`](PLAN.md) (fases 0–8, hito MVP, decisiones tomadas y abiertas, riesgos).
- Decisiones tomadas con R3ZON: sin registro público (solo invitación, con email +
  contraseña o Google); staff de R3ZON frente a usuarios de cliente; firma electrónica
  simple propia; Stripe como única pasarela con pago único o señal + entrega por
  transferencia/SEPA (recomendado) o tarjeta; facturas con Stripe y más adelante con
  ANTARES.
- Documentos de la plantilla vaciados según [TEMPLATE.md](TEMPLATE.md): bitácora, tareas,
  `auditoria.md` y `mejoras.md` (esta se rellena con las ideas de producto candidatas).
  Borrado `auditoria-template-final.md`.
- `ARCHITECTURE.md`, `AUTH.md`, `ROLES.md`, `DATABASE.md`, `MODULES.md`, `STACK.md`,
  `STRUCTURE.md`, `DEPLOYMENT.md`, `RESTAURACION.md` y `DEVELOPMENT.md` conservan lo que
  describe el core y añaden lo **previsto** para Excelsior, marcado como tal para no
  confundir plan con estado.
- Descartado por ahora: firma con proveedor externo (coste por envío; la firma simple
  basta para contratos B2B de servicios) y pasarelas distintas de Stripe (un solo
  proveedor que mantener).
