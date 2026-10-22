# Plan de desarrollo por fases

Hoja de ruta de Excelsior desde la plantilla hasta el área de clientes completa. Qué es
el producto y por qué: [PRODUCTO.md](PRODUCTO.md).

> **Cómo se usa este documento.** Es el plan, no la lista de tareas. Cuando una fase
> arranca, sus entregables pasan a [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) como
> tareas concretas; al cerrarse, se cuenta en [CHANGELOG.md](CHANGELOG.md) y aquí se
> marca la fase. Si el plan cambia, se cambia aquí con su motivo, no en silencio.
>
> Última revisión: **2026-10-22** (plan inicial + revisión: recorrido vertical,
> máquinas de estados, validaciones jurídica y fiscal, retención y seguridad de
> ficheros).

Leyenda: ⬜ sin empezar · 🚧 en curso · ✅ cerrada. Tamaño relativo: **S** · **M** · **L** · **XL**.

## Resumen

| Fase | Qué | Tamaño | Estado |
|---|---|---|---|
| 0 | Adaptar el repositorio y cimientos (identidad, marca, servicios, decisiones) | M | 🚧 |
| 1 | Acceso: invitaciones, login con email y Google, contraseña, empresas y roles | L | ⬜ |
| **🧪 Hito V** | **Recorrido vertical mínimo**: un servicio, un contrato, un medio de pago y una checklist, de invitación a proyecto (partes «V» de las fases 2–5) | L | ⬜ |
| 2 | Panel R3ZON: clientes, catálogo de servicios e invitaciones con servicio | L | ⬜ |
| 3 | Onboarding de contratación: bienvenida, datos, contrato y firma | XL | ⬜ |
| 4 | Pagos con Stripe y facturas | L | ⬜ |
| 5 | Briefing del proyecto y zona de documentos (tipo Drive) | L | ⬜ |
| **🚩 Hito MVP** | **Primer cliente real hace el flujo completo** (fases 0–5 + salida a producción) | | |
| 6 | Área de cliente: servicios, proyectos, propuestas y mejoras de plan | L | ⬜ |
| 7 | Soporte: sistema de tickets | M | ⬜ |
| 8 | Integración con ANTARES (facturación certificada) | M | ⬜ |
| 9+ | Mejoras continuas (ver [mejoras.md](mejoras.md)) | — | — |

El orden sigue el flujo estrella ([PRODUCTO.md](PRODUCTO.md) §6): cada fase deja algo
usable sobre la anterior. Las fases 2 a 5 **no se construyen como motores genéricos de
entrada**: primero se recorre el flujo entero con un solo caso real (Hito V) y después se
generaliza ([«Hito V»](#hito-v--recorrido-vertical-mínimo)). La salida a producción no es una fase: es una lista de
comprobación (abajo) que se cumple **antes** de que entre el primer cliente real.

---

## Cómo se trabaja cada fase

Igual en todas, y no se repite en cada una:

- **Definición de «hecho»** de [`CLAUDE.md`](../CLAUDE.md) §3 para cada tarea: lint,
  typecheck, tests (incluidos los de BD contra Postgres real para toda tabla nueva), E2E
  si toca rutas o auth, bitácora y documentos al día.
- **Toda tabla nueva**: RLS, policies por acción, grants mínimos, índices de FK, triggers
  para las reglas de negocio y tests de que un cliente **no ve nada de otro**
  ([DATABASE.md](DATABASE.md)).
- **Diseño responsive** comprobado en móvil (375 px), tablet (768 px) y escritorio, y
  jest-axe en los componentes nuevos.
- **Módulos de la plantilla**: si una fase necesita uno del catálogo
  ([`modules/README.md`](../modules/README.md)) que aún no existe, se construye aquí
  respetando su contrato y se apunta en [MODULES.md](MODULES.md). Lo que sirva a otros
  productos se propone después para la plantilla.
- **Decisiones importantes** (arquitectura, seguridad, datos, alcance): se preguntan
  antes ([`CLAUDE.md`](../CLAUDE.md) §1). Las ya tomadas están en
  [«Decisiones»](#decisiones-tomadas) y las pendientes en
  [«Decisiones abiertas»](#decisiones-abiertas).

---

## Fase 0 — Adaptar el repositorio y cimientos

**Objetivo:** que el repositorio deje de ser la plantilla y sea Excelsior, con la marca de
r3zon.com, y que todas las decisiones que bloquean la Fase 1 estén tomadas.

**Entregables**

1. **Identidad** según [TEMPLATE.md](TEMPLATE.md) → Crear un proyecto:
   - `src/config/project.ts`: `slug: "excelsior"`, `domain: "clientes.r3zon.com"`,
     `organization: "R3ZON"`, nombre visible «R3ZON Clientes» (T-10), descripción. ✅
   - `package.json`, `supabase/config.toml` (`project_id` y rango de puertos **5542x**),
     `public_docs/_meta/*`, `public_docs/index.md`. ✅
   - `CLAUDE.md` §0 completo y `README.md` del producto. ✅
2. **Marca y sistema visual de r3zon.com**: tokens extraídos del CSS de la web
   (tinta `#05010f`, magenta `#e549ff`, rosa, violeta y lavanda; Inter y Sora; botones
   píldora con resplandor) en `src/app/globals.css`; logotipo e icono. Solo oscuro, como
   la web (T-14). ✅
3. **Esqueleto de la interfaz**: navegación declarada en `src/config/navegacion.ts`,
   barra lateral en escritorio, cabecera y barra inferior en móvil; login, portada e
   inicio con la marca; `Card`, `Badge` y `Stepper`. Probado en 375, 768 y 1280 px, y
   los E2E corren en escritorio y en móvil. ✅
   - `Dialog`, `Toast`, `Tabs` y `Dropzone` **se construyen en la fase que los use por
     primera vez** (fases 1, 3 y 5), no antes: un componente sin pantalla que lo use se
     diseña a ciegas y nadie lo prueba de verdad. Los estados vacíos, de carga y de
     error, igual: con la primera pantalla que tenga datos.
4. **Servicios externos dados de alta** (sin datos reales): Supabase Cloud (región UE),
   Vercel con `clientes.r3zon.com`, Sentry, cuenta de Stripe en modo test, Resend con el
   dominio de envío verificado, proyecto en Google Cloud para OAuth.
5. **CI en verde en GitHub** (primera ejecución real de los workflows de la plantilla).
6. **Decisiones** que bloquean las fases 0 y 1 cerradas: D-01, D-02, D-03 y D-09
   (ahora T-10 a T-13). Las demás se cierran antes de la fase que bloquea cada una. ✅

**Hecho cuando:** `docs:validar` y los tests de derivación en verde con la identidad de
Excelsior; una página de muestra con la estética de r3zon.com se ve bien en móvil, tablet
y escritorio; el despliegue de preview en Vercel responde.

---

## Fase 1 — Acceso: invitaciones, login, contraseña, empresas y roles

**Objetivo:** que solo un invitado pueda tener cuenta, con email y contraseña o con
Google, y que cada usuario vea exactamente lo que le toca.

**Módulos de la plantilla:** `auth-advanced` (OAuth, recuperación y cambio de contraseña,
aceptación de invitación), `multi-tenancy` (cliente = organización), `roles-permissions`
(staff × miembro de cliente), `email-resend` (emails propios con la marca), `audit-log`
(base).

**Entregables**

0. **Prototipo técnico de invitación + Google**, antes del resto de la fase, en una rama
   que se tira o se reaprovecha. Tiene que demostrar, con tests:
   - que el token de invitación **sobrevive al viaje de OAuth** (ida a Google y vuelta al
     callback) sin exponerse en la URL final ni en logs;
   - que el **email de Google coincide** con el invitado y, si no, no se crea nada;
   - que la invitación se **consume una sola vez**, también con dos pestañas a la vez
     (sin carreras: consumo y alta de pertenencia en una sola transacción);
   - que un alta por Google **sin invitación** se rechaza en el servidor (*before user
     created hook*).

   Si algún punto no sale, se replantea la Fase 1 antes de construirla.
1. **Modelo de organizaciones**: `organizations` (cliente), `organization_members`
   (usuario ↔ cliente con rol), `staff_members` o nivel de plataforma en el perfil
   (decisiones T-12 y T-13). RLS por pertenencia; R3ZON ve todo vía función de permiso, nunca
   saltándose la RLS ([ROLES.md](ROLES.md)).
2. **Invitaciones**: `invitations` con token de un solo uso (guardado como **hash**),
   caducidad, email destinatario, organización y — en Fase 2 — servicio. Página pública
   `/invitacion/[token]` que valida el token y ofrece:
   - crear cuenta con **email + contraseña**, o
   - **continuar con Google**.

   La cuenta se crea **solo** si la invitación es válida; el email debe coincidir con el
   invitado (decisión T-11). Sin invitación, `/login` no ofrece registrarse y el alta por
   Google de un email desconocido se rechaza (bloqueo en servidor, no solo en la UI:
   *before user created hook* de Supabase o equivalente).
3. **Login** con email + contraseña y con Google; **vincular Google** a una cuenta
   existente desde «Mi cuenta».
4. **Recuperación de contraseña** («¿la has olvidado?») y **cambio de contraseña**
   estando dentro. Página de nueva contraseña con la política de longitud de Supabase.
5. **Emails transaccionales con la marca** (invitación, recuperación, cambio de
   contraseña, bienvenida) vía Resend como SMTP de Supabase Auth y plantillas propias.
6. **Mi cuenta**: nombre, contraseña, Google vinculado, cerrar otras sesiones.
7. **2FA (TOTP) obligatorio para staff** (opcional para clientes).
8. **Registro de actividad** (audit log) de lo sensible: login, invitación aceptada,
   cambio de contraseña, cambio de rol.

**Hecho cuando:** tests de BD prueban que un miembro de A no ve nada de B y que el staff
ve ambos; E2E: aceptar invitación con contraseña, rechazar invitación caducada/usada,
intento de alta sin invitación rechazado, login, recuperación, cambio de contraseña. URLs
públicas comprobadas sin cookie (`CLAUDE.md` §10).

---

## Fase 2 — Panel R3ZON: clientes, servicios e invitaciones

**Objetivo:** que R3ZON pueda dar de alta un cliente, decidir qué servicio contrata y
enviarle el enlace, todo desde el panel.

**Entregables**

0. **Máquinas de estados** de invitación, contratación, contrato, pago y proyecto,
   escritas en [ARCHITECTURE.md](ARCHITECTURE.md) §20 **antes** de la primera migración
   de esta fase, incluidos los caminos no felices (revocación, devolución, disputa,
   reembolso, abono, contrato sustituido). Cada transición permitida se aplica con un
   trigger y tiene su test.
1. **Zona `/admin`** (solo staff; protegida en el proxy, en el layout y por RLS).
2. **Clientes**: listado con búsqueda y filtro por estado, alta manual, ficha (datos
   fiscales, usuarios, contrataciones, actividad). Alta manual **sin** invitación posible
   (cliente que aún no usa el portal).
3. **Catálogo de servicios** (`services`): nombre, descripción comercial, qué incluye,
   precio base, IVA, modalidades de pago permitidas (pago único / señal + entrega,
   porcentaje de señal), plantilla de contrato asociada y plantilla de briefing.
   Versionado: cambiar un servicio no altera lo ya contratado.
4. **Generar invitación con servicio**: elegir cliente (o crearlo al vuelo) + email +
   servicio + precio final (con descuento si aplica) + condiciones particulares → crea la
   **contratación en borrador** y la invitación. Copiar enlace o enviarlo por email.
   Reenviar, revocar, ver caducidad.
5. **Embudo de onboarding**: en qué paso está cada contratación (invitado → cuenta creada
   → datos → firmado → pagado → briefing completo), con fecha de cada paso.
6. **Ver como cliente** (solo lectura, registrado en el audit log) para soporte.

**Hecho cuando:** E2E del staff: crear cliente, crear servicio, generar invitación y
verla aceptada en el embudo. Tests de BD: un usuario cliente no puede leer `services`
internos (precios de coste, notas) ni ninguna ruta de `/admin`.

---

## Fase 3 — Onboarding de contratación: bienvenida, datos, contrato y firma

**Objetivo:** el corazón del producto. Tras crear la cuenta, el cliente recorre un
asistente con la estética de r3zon.com hasta dejar el contrato firmado.

**Bloqueante al empezar:** la validación jurídica de la firma (decisión D-10). Sin ella
no se pone un contrato real a firmar.

**Entregables**

1. **Motor de asistente por pasos** reutilizable (también para propuestas en Fase 6):
   progreso visible, guardado automático, retomar donde se dejó, «completar más tarde»
   en los pasos que no bloquean.
2. **Bienvenida premium** por servicio: agradecimiento, qué incluye lo contratado, qué
   pasará a continuación y quién es su contacto en R3ZON. Contenido editable desde el
   catálogo de servicios.
3. **Datos para contrato y factura** (`organization_billing`): razón social, NIF/CIF,
   dirección fiscal, tipo (empresa/autónomo, UE/no UE para el IVA), **firmante** (nombre,
   DNI, cargo) y contacto de facturación. Validación de NIF/CIF y de IVA intracomunitario
   (VIES) si aplica.
4. **Modalidad de pago**: el cliente elige entre las que permite el servicio — pago único
   o señal + entrega — y el medio: **transferencia/SEPA (recomendado, destacado)** o
   tarjeta. La elección entra en el contrato.
5. **Plantillas de contrato versionadas** (`contract_templates`) con variables (cliente,
   servicio, precio, modalidad, fechas) y condiciones generales. Generación del **PDF en
   servidor** ([ARCHITECTURE.md](ARCHITECTURE.md) §17).
6. **Previsualización y firma in situ**: el contrato se ve completo (también en móvil),
   el firmante marca la aceptación, firma (dibujada o tecleada) y confirma con un
   **código enviado a su email**. Se guarda el PDF final sellado con hoja de evidencias:
   hash SHA-256, fecha, IP, agente, identidad y versión de la plantilla. Inmutable.
7. **Contrato de encargado del tratamiento (DPA)** cuando el servicio implique tratar
   datos personales del cliente (webs con formularios, ecommerce): se firma en el mismo
   paso (decisión D-05).
9. **Firmante y pagador distintos de quien abre la invitación** (decisión D-12): si
   quien completa los datos no es el representante legal, puede **enviar el contrato a
   firmar** a otra persona de su empresa (que recibe su propia invitación con rol
   `owner`), y lo mismo con el **pago** hacia alguien con rol `billing`. El asistente
   muestra en qué paso está y a quién espera.
8. **Email** con la copia del contrato firmado a firmante y a R3ZON.

**Hecho cuando:** E2E del flujo completo invitación → firma, en escritorio y en viewport
móvil. Tests: el PDF firmado no se puede modificar ni borrar por ningún rol de la app;
el hash guardado coincide con el fichero; un contrato firmado no cambia aunque cambie la
plantilla o el servicio.

---

## Fase 4 — Pagos con Stripe y facturas

**Objetivo:** cobrar dentro del onboarding con la modalidad elegida y dejar la factura
disponible.

**Módulo de la plantilla:** `billing-stripe` (versión de API fijada, webhooks
idempotentes).

**Bloqueante al empezar:** la validación fiscal de las facturas de Stripe (decisión
D-11), **al principio de la fase y no al final**: si Stripe Invoicing no sirve, cambia el
diseño de los entregables 6 y 8, y con los plazos de adaptación de la AEAT en 2027 hay
poco margen para una solución provisional que luego haya que reemplazar.

**Entregables**

1. **Cliente de Stripe por organización**, creado al confirmar los datos de facturación.
2. **Medios de pago** (todo vía Stripe): **transferencia bancaria** (Stripe Bank
   Transfers, IBAN virtual por cliente), **SEPA Direct Debit** y **tarjeta**. PayPal y
   criptomonedas solo si Stripe los ofrece para la cuenta, como fase posterior
   ([mejoras.md](mejoras.md)).
3. **Pago embebido** con la estética del portal (Payment Element, no una página de
   Stripe genérica), salvo que la decisión D-04 diga otra cosa.
4. **Modalidades**: pago único; **señal + entrega** (se cobra la señal en el onboarding y
   el resto se emite cuando R3ZON marca la entrega; el cliente recibe aviso y paga desde
   el portal).
5. **Webhooks** (`/api/stripe/webhook`): firma verificada, idempotencia por id de evento,
   y la máquina de estados completa del pago ([ARCHITECTURE.md](ARCHITECTURE.md) §20):
   no solo pagado o fallido, también **devuelto** (adeudo SEPA rechazado días después),
   **en disputa**, **reembolsado** total o parcialmente, con su **factura rectificativa**. **Los pagos asíncronos**
   (transferencia, SEPA) dejan la contratación en «pago en curso» con su propia pantalla
   de confirmación ([PRODUCTO.md](PRODUCTO.md) §6).
6. **Facturas con Stripe Invoicing** (decisión tomada; ver Fase 8 para ANTARES): IVA
   correcto (21 %, inversión del sujeto pasivo UE, exento fuera de la UE), numeración y
   envío por email; visibles y descargables en el portal.
7. **Pantalla de enhorabuena** y emails (cliente y R3ZON).
8. **Panel R3ZON**: cobros pendientes, marcar entrega (dispara el segundo pago), pagos
   fallidos con reintento.

**Hecho cuando:** E2E con Stripe en modo test (tarjeta de prueba y SEPA de prueba);
tests del webhook: evento repetido no duplica nada, eventos fuera de orden no
retroceden un estado, firma inválida → 400, un pago no se puede marcar como pagado desde
el cliente; un adeudo devuelto y un reembolso dejan contratación y factura en el estado
correcto.

---

## Fase 5 — Briefing del proyecto y zona de documentos

**Objetivo:** sustituir el documento-lista por una checklist viva y un espacio tipo
Google Drive.

**Módulo de la plantilla:** `file-storage` (buckets privados, URLs firmadas).

**Entregables**

1. **Proyecto** (`projects`) creado al firmar/pagar, ligado a la contratación.
2. **Plantillas de briefing por servicio**: lista de elementos tipados — fichero (logo,
   isotipo, imágenes), color (selector + HEX), tipografía, texto largo (sobre nosotros,
   servicios…), enlace — con ayuda y ejemplos en cada uno. Obligatorio / opcional.
   **No hay tipo «acceso»:** el portal no recoge contraseñas ni credenciales (hosting,
   dominio, redes) en ningún campo ni documento hasta que exista la bóveda cifrada
   ([mejoras.md](mejoras.md)). Mientras tanto, el elemento del briefing solo dice
   **qué** accesos hacen falta y R3ZON los recoge por su canal seguro habitual.
3. **Briefing del cliente**: progreso (porcentaje), «aportar más tarde», marcar como
   «no aplica», comentarios de R3ZON por elemento («este logo está pixelado»).
4. **Datos para textos legales** que falten (responsable del tratamiento, DPO si hay,
   finalidades, cookies que usará la web…), reutilizando lo ya dado en Fase 3.
5. **Zona de documentos tipo Drive** por proyecto: carpetas, subida por arrastre y desde
   el móvil (cámara incluida), vista previa de imágenes y PDF, descarga, límites de tamaño
   y tipo, papelera. Supabase Storage privado; las rutas llevan la organización y la RLS
   de `storage.objects` lo comprueba.
6. **Seguridad de ficheros** ([ARCHITECTURE.md](ARCHITECTURE.md) §19): subida a
   **cuarentena** y análisis antimalware antes de quedar disponible; tipo MIME comprobado
   en servidor por contenido (no por extensión); nombres normalizados; límites de tamaño
   y, para ZIP, de tamaño descomprimido y número de entradas; metadatos EXIF (ubicación)
   eliminados de las imágenes.
7. **Recordatorios**: email automático si el briefing lleva X días incompleto (cron de
   Vercel), con enlace directo a lo que falta.
8. **Panel R3ZON**: estado del briefing por proyecto, descarga de todo el material en ZIP
   (en el navegador, [ARCHITECTURE.md](ARCHITECTURE.md) §8).

**Hecho cuando:** tests de Storage: un cliente no puede leer ni listar ficheros de otro
ni adivinando la ruta; un fichero en cuarentena no se puede descargar; un tipo
disfrazado (ejecutable con extensión `.jpg`) se rechaza; E2E de subir, ver y borrar desde
viewport móvil.

---

## Hito V — Recorrido vertical mínimo

**Objetivo:** validar el flujo principal de punta a punta con **un solo caso real** antes
de construir catálogos, plantillas y medios de pago genéricos. Se hace justo después de la
Fase 1 y está formado por la parte mínima de las fases 2 a 5:

| Fase | Parte «V» (mínima) | Se generaliza después |
|---|---|---|
| 2 | Un servicio real (decisión D-08) dado de alta por migración de datos o por un formulario mínimo; generar la invitación con ese servicio; embudo en una tabla simple | Catálogo editable, versiones, descuentos, ficha completa del cliente, «ver como cliente» |
| 3 | Bienvenida, datos de facturación, una plantilla de contrato, firma con OTP y PDF sellado | Plantillas versionadas por servicio, DPA, firmante delegado |
| 4 | Pago único por **transferencia** (la recomendada; obliga a resolver «pago en curso» desde el primer día) y factura | SEPA, tarjeta, señal + entrega, devoluciones y reembolsos completos |
| 5 | Proyecto creado, una checklist de briefing fija y subida de ficheros segura | Plantillas de briefing por servicio, zona tipo Drive completa, recordatorios |

Las máquinas de estados (Fase 2, entregable 0) y la seguridad de ficheros se hacen
**completas** ya en el Hito V: son lo caro de rehacer.

**Hecho cuando:** un usuario de prueba recorre en el entorno de preview, desde el móvil,
invitación → cuenta con Google → datos → firma → transferencia de prueba → enhorabuena →
sube su logo; y R3ZON lo ve todo en el panel. Lo aprendido se apunta en la bitácora y, si
cambia el plan, aquí.

---

## 🚩 Hito MVP y salida a producción

Antes de que entre el primer cliente real:

- [ ] Fases 0 a 5 cerradas.
- [ ] **Backups** decididos e instalados, **incluido Storage** (contratos firmados y
      materiales): [RESTAURACION.md](RESTAURACION.md). Simulacro de restauración hecho.
- [ ] **CSP** definida con la lista real de terceros (Supabase, Stripe, Sentry, Google,
      Vercel): [mejoras.md](mejoras.md) → «CSP».
- [ ] **Ciclo de vida y retención de datos** decidido y aplicado (decisión D-13):
      cuánto se conservan contratos, facturas, documentos, invitaciones, audit log e
      IPs; exportación de los datos de un cliente; baja y anonimización; qué pasa con
      los backups al borrar; y **bloqueo legal** que impide borrar lo que la ley obliga a
      conservar (contratos, facturas).
- [ ] **Páginas legales** del portal (aviso legal, privacidad, cookies, condiciones de
      uso) y consentimiento si hay analítica (módulo `legal-consent`).
- [ ] **Auditoría de seguridad** completa en [auditoria.md](auditoria.md): RLS de todas
      las tablas, Storage, webhooks, invitaciones, firma.
- [ ] Stripe en modo live, Google OAuth verificado (pantalla de consentimiento con la
      marca), Resend con SPF/DKIM/DMARC.
- [ ] `public_docs/` con las guías del cliente (aceptar invitación, firmar, pagar, subir
      materiales) — ayuda que el portal enlaza.
- [ ] Prueba completa con un cliente de confianza (o interno) en producción.
- [ ] `CLAUDE.md` §0 → «Datos de producción» actualizado con la fecha.

---

## Fase 6 — Área de cliente: servicios, proyectos, propuestas y mejoras de plan

**Objetivo:** que el portal sea el sitio de la relación continua, no solo del alta.

**Entregables**

1. **Inicio del cliente** con pendientes (firmar, pagar, aportar), avisos y actividad.
2. **Servicios contratados** con estado y plan; **Proyectos** con fases (briefing →
   diseño → desarrollo → revisión → lanzamiento) y fecha estimada de cada una.
3. **Propuestas y presupuestos**: R3ZON los crea desde el panel (líneas, opciones
   alternativas, extras opcionales, validez); el cliente los ve, elige opciones y
   **acepta → firma → paga** reutilizando el asistente de las fases 3 y 4. También
   rechazar con motivo. Clientes ya existentes no necesitan invitación nueva.
4. **Mejorar plan** (mantenimiento u otros servicios recurrentes): **suscripciones de
   Stripe**, cambio de plan con prorrateo, anexo de contrato firmado.
5. **Usuarios de la empresa**: el responsable del cliente invita a compañeros y elige su
   rol (ver [ROLES.md](ROLES.md)).
6. **Notificaciones** en el portal (campana) además de email.

---

## Fase 7 — Soporte: tickets

**Objetivo:** que los problemas lleguen ordenados y con contexto, no por WhatsApp.

**Entregables**

1. **Tickets** (`tickets`, `ticket_messages`): asunto, proyecto/servicio, categoría,
   prioridad, adjuntos (reutiliza `file-storage`), estados (abierto → en curso →
   esperando cliente → resuelto → cerrado).
2. Conversación por ticket con notas internas que el cliente **no** ve (RLS por columna o
   tabla separada; test que lo pruebe).
3. **SLA por plan** (tiempo de primera respuesta) y avisos al staff.
4. Bandeja del staff: asignación, filtros, métricas básicas.
5. Emails en cada respuesta, y respuesta del cliente por email que entra en el ticket
   (opcional, con Resend inbound).
6. Valoración al cerrar.

---

## Fase 8 — Integración con ANTARES

**Objetivo:** que la factura legal la emita **ANTARES** (producto de facturación de
R3ZON), cumpliendo VeriFactu, y que Stripe quede solo como pasarela de cobro.

**Entregables** (a detallar cuando ANTARES exponga su API; decisión D-06):

1. Al confirmarse un pago en Stripe, Excelsior pide a ANTARES la emisión de la factura
   (idempotente) y guarda su referencia.
2. El portal muestra y descarga la factura de ANTARES; las de Stripe anteriores se
   conservan como estaban.
3. Sincronización de clientes (datos fiscales) Excelsior → ANTARES.
4. Plan de corte: desde qué fecha deja de facturar Stripe.

---

## Fase 9+ — Mejoras continuas

Cada sección nueva entra como una fase o como tarea suelta, según tamaño. Las ideas
candidatas, con lo que desbloquea cada una, están en [mejoras.md](mejoras.md).

---

## Decisiones tomadas

| ID | Decisión | Fecha | Motivo |
|---|---|---|---|
| T-01 | Nombre interno **Excelsior**; público en **`clientes.r3zon.com`**, con la estética de r3zon.com y responsive (móvil y tablet) | 2026-10-22 | Es la parte privada de la web corporativa: tiene que sentirse la misma marca |
| T-02 | **Sin registro público**: toda cuenta nace de una invitación de R3ZON; el usuario elige email + contraseña o Google | 2026-10-22 | Solo pueden acceder clientes |
| T-03 | Dos tipos de usuario: **staff de R3ZON** (panel con todos los clientes) y **usuarios de cliente** (solo lo suyo) | 2026-10-22 | |
| T-04 | **Firma electrónica simple propia** con evidencias (hash, OTP por email, IP, fecha, hoja de auditoría) como solución técnica, **pendiente de validación jurídica** (D-10) | 2026-10-22 | Sin coste por firma y sin sacar al cliente del portal. eIDAS (art. 25) impide rechazar una firma solo por ser electrónica, pero solo la cualificada equivale automáticamente a la manuscrita: la suficiencia la decide la asesoría, no este plan |
| T-05 | **Stripe** como única pasarela. Modalidades que elige el cliente: **pago único** o **señal + entrega**, por **transferencia/SEPA (recomendado)** o **tarjeta**. PayPal y cripto, más adelante y vía Stripe | 2026-10-22 | Un solo proveedor que mantener; la transferencia es la opción preferida por R3ZON |
| T-06 | Factura **Stripe Invoicing** al principio, **si pasa la validación fiscal** (D-11); después **ANTARES** | 2026-10-22 | ANTARES es el producto de facturación de R3ZON |
| T-07 | El portal **no recoge credenciales** (contraseñas de hosting, dominio, redes) hasta que exista la bóveda cifrada | 2026-10-22 | Un campo de texto o un documento normal no es sitio para una contraseña: la vería cualquiera con acceso al proyecto y acabaría en los backups |
| T-08 | La columna de pertenencia es **`organization_id`** en todo el proyecto (no `tenant_id`) | 2026-10-22 | Un solo nombre antes de la primera migración; «organización» es el término del dominio ([PRODUCTO.md](PRODUCTO.md) §5) |
| T-09 | **Recorrido vertical** (Hito V) antes de generalizar las fases 2–5 | 2026-10-22 | Validar el flujo con un caso real antes de construir tres motores genéricos |
| T-10 | Nombre visible **«R3ZON Clientes»** (`project.name`) | 2026-10-22 | Corto y cabe en la cabecera móvil (era D-01) |
| T-11 | La invitación queda **atada al email** al que se envía; con Google, el email de la cuenta de Google debe coincidir. Si el cliente quiere otro email, R3ZON reenvía la invitación | 2026-10-22 | Un enlace reenviado no da acceso a otra persona (era D-02) |
| T-12 | Dos niveles en el equipo: **`admin`** (todo, incluidos catálogo, precios y usuarios del equipo) y **`staff`** (clientes, proyectos y tickets) | 2026-10-22 | Era D-03 |
| T-13 | Un usuario puede pertenecer a **varias empresas cliente**, con selector de empresa | 2026-10-22 | Agencias, gestorías y personas que llevan varias empresas; cambiarlo después obligaría a migrar (era D-09) |
| T-14 | Interfaz **solo en modo oscuro**, como r3zon.com | 2026-10-22 | «Misma estética que la web»: la web no tiene tema claro. Los tokens permiten añadir uno sin tocar componentes |

## Decisiones abiertas

Bloquean la fase indicada. Cada una lleva una recomendación; la decisión es de R3ZON.

| ID | Pregunta | Recomendación | Bloquea |
|---|---|---|---|
| D-04 | Pago **embebido** (Payment Element, estética propia) o **Stripe Checkout** (página de Stripe, menos trabajo) | Embebido: el flujo «premium» es el motivo del producto | Fase 4 |
| D-05 | ¿Qué servicios exigen **DPA** (encargo del tratamiento)? ¿Hay ya textos de contrato y condiciones por servicio? | Pedir a la asesoría plantillas: contrato marco + condiciones por servicio + DPA | Fase 3 |
| D-06 | ¿ANTARES tiene o tendrá **API** para emitir facturas y dar de alta clientes? | Definir el contrato de la API antes de la Fase 8 | Fase 8 |
| D-07 | **Plan de Supabase**: Free (sin backups, 1 GB de Storage, 50 MB por fichero) o Pro | Pro antes del MVP: contratos firmados y materiales no pueden depender de un plan sin backups | Hito MVP |
| D-08 | **Catálogo inicial** de servicios, con precios, modalidades y porcentaje de señal | Empezar con 2–3 (web corporativa, ecommerce, mantenimiento) | Fase 2 |
| D-10 | **Validación jurídica de la firma propia**: ¿para qué contratos y servicios basta la firma simple con estas evidencias? ¿Qué evidencias exige la asesoría, cuánto se conservan y cómo? ¿Hace falta sello de tiempo cualificado? | Llevar a la asesoría el diseño de [ARCHITECTURE.md](ARCHITECTURE.md) §17 y un PDF de ejemplo con su hoja de evidencias | Fase 3 (Hito V) |
| D-11 | **Validación fiscal de Stripe Invoicing**: ¿cumplen sus facturas los requisitos españoles (numeración, datos, rectificativas, IVA intracomunitario) y el calendario de adaptación de la AEAT? Si no, ¿se adelanta ANTARES o se factura fuera mientras tanto? | Revisión con la asesoría con una factura de prueba real de Stripe | Fase 4 (Hito V) |
| D-12 | **¿Quién firma y quién paga?** Quien abre la invitación puede no ser el representante legal ni administración | El asistente permite delegar firma (a un `owner`) y pago (a un `billing`) de la misma empresa | Fase 3 |
| D-13 | **Retención de datos**: plazos por tipo de dato, exportación, baja, anonimización y bloqueo legal | Plazos de la asesoría; aplicarlos por trigger y tarea programada | Hito MVP |

## Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | **Pagos asíncronos** (transferencia, SEPA) tardan días y pueden fallar después de «pagado» | Estados explícitos y webhooks; el proyecto arranca con firma + pago en curso solo si R3ZON lo decide |
| R-02 | **Facturas de Stripe y normativa española** (requisitos de factura y adaptación de los sistemas de facturación, con plazos de la AEAT en 2027) | Decisión D-11 al **empezar** la Fase 4; ANTARES (Fase 8) antes de la fecha obligatoria |
| R-03 | **Validez de la firma propia** si hay disputa | Decisión D-10 antes de firmar contratos reales; evidencias completas, OTP por email, documento inmutable; sello de tiempo cualificado (TSA) si la asesoría lo pide |
| R-04 | **Material del cliente** es sensible y voluminoso, y puede traer malware | Storage privado, URLs firmadas de corta duración, cuarentena y análisis, sin credenciales (T-07), backups de Storage |
| R-06 | **Estados no lineales** de pagos y contratos (devoluciones, disputas, reembolsos, sustituciones) tratados como casos raros | Máquinas de estados completas antes de la primera migración de la Fase 2 ([ARCHITECTURE.md](ARCHITECTURE.md) §20) |
| R-05 | **Alta por Google sin invitación** si el bloqueo solo está en la interfaz | Bloqueo en servidor (hook de Supabase Auth) y E2E que lo intente |
