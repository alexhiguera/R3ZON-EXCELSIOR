# Auditorías de seguridad

Registro de revisiones de seguridad: qué se revisó, qué se encontró y en qué estado está
cada hallazgo. Las revisiones nuevas van **arriba**.

Formato de un hallazgo: `ID` · severidad (🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja) ·
estado (**abierto** / **cerrado** en la iteración N / **aceptado** con su motivo).

Hallazgos del core heredados de la plantilla que siguen abiertos para este producto: la
**CSP** (ya en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)).

**Antes del hito MVP** ([PLAN.md](PLAN.md)) se hace una auditoría completa con todo lo
construido hasta entonces: además de lo de abajo, firma de contratos, webhooks de
Stripe, Storage y «ver como cliente».

---

## Auditoría 1 — *2026-10-23* — Compartimentación de datos, RLS y RGPD (fases 1–2)

**Alcance.** El esquema completo (módulos base, plataforma, organizaciones,
invitaciones, servicios y contrataciones), la configuración de Supabase Auth, el alta
por invitación, el panel de R3ZON y la arquitectura de la app frente a fallos de un
módulo. Referencias: OWASP ASVS 4 (V1 arquitectura, V2 autenticación, V4 control de
acceso, V7 registro, V8 protección de datos), NIST SP 800-63B (contraseñas) y RGPD
arts. 5, 25 y 32 ([RGPD.md](RGPD.md)).

**Qué se comprobó y cómo.**

- **Privilegios reales en la base**, consultando el catálogo de Postgres (no el código):
  `anon` no tiene ningún privilegio en `public`; `authenticated` tiene `SELECT` y
  escrituras limitadas **por columna**; nadie puede crear objetos en el esquema; las
  funciones que se saltan la RLS y puede ejecutar un usuario son exactamente las 6
  declaradas en `security-catalog.test.ts`, cada una con su motivo.
- **Compartimentación por cliente** con tests contra Postgres real (`tests/db/`, 71
  tests): un cliente no ve organizaciones, compañeros, invitaciones, contrataciones,
  historial ni servicios de otro cliente, ni del catálogo; el staff lo ve todo **por
  permiso** dentro de las mismas policies.
- **Reglas que ninguna vía puede saltarse** (triggers, probados también como `postgres`):
  transiciones de invitaciones y contrataciones, inmutabilidad del registro y del
  historial, propietario mínimo, versiones de servicio inmutables, condiciones
  congeladas tras los datos del cliente.
- **Catálogo vigilado para lo que venga:** RLS en toda tabla, al menos una policy por
  tabla, ningún grant a `anon`, índices de FK, PK con `uuidv7()`, `search_path` en las
  definer, y ninguna tabla de negocio borrada en cascada con la organización.
- **Alta**: E2E contra el Auth real (alta directa a la API sin invitación → 403, token
  no guardado, email distinto, enlace usado).
- **Aislamiento de fallos**: test de componente (un bloque que falla no tumba a sus
  vecinos) y test de fronteras entre módulos.

### Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| A1-1 | 🟠 | `audit_log.details` guardaba el **email** de cada invitación: un dato personal duplicado en el registro que más tiempo se conserva | **Cerrado** (iteración 5): el registro solo guarda ids y estados; un test busca emails, nombres y tokens en él |
| A1-2 | 🟠 | El registro de actividad se podía modificar o borrar con `postgres` o `service_role` (la RLS no los frena). Para ser evidencia tiene que ser inmutable | **Cerrado** (iteración 5): trigger que rechaza `UPDATE`/`DELETE`/`TRUNCATE` a todos; purga solo de > 6 años y solo `service_role` |
| A1-3 | 🟠 | `audit_log.actor_id` con `on delete set null`: al suprimir a un usuario se perdía quién hizo qué | **Cerrado** (iteración 5): sin FK; el id queda seudonimizado (no apunta a nadie) y la traza sigue sirviendo |
| A1-4 | 🟠 | Nada impedía que una tabla de negocio futura se borrara **en cascada** con su organización, contra la conservación de 6 años | **Cerrado** (iteración 5): organizaciones archivables y sin `DELETE` para la app; contrataciones con `on delete restrict`; regla de catálogo que lo vigila |
| A1-5 | 🟡 | Contraseña mínima de 8 caracteres sin segundo factor para los clientes. NIST SP 800-63B pide 15 si la contraseña es el único factor | **Cerrado** (iteración 5): 12 como mínimo (decisión T-19) y `secure_password_change`; queda como **aceptado** el margen hasta 15 |
| A1-6 | 🟡 | Una invitación podía insertarse a mano con validez arbitraria (años), saltándose `create_invitation` | **Cerrado** (iteración 5): CHECK de validez máxima de 30 días en la tabla |
| A1-7 | 🟡 | Las invitaciones cerradas guardaban para siempre el email de personas que quizá nunca fueron clientes (minimización) | **Cerrado en la base** (iteración 5): función de purga; **abierto** programarla (con D-13) |
| A1-8 | 🟡 | CHECK de la señal de un servicio que se evaluaba a `NULL` (y Postgres da por cumplido un CHECK `NULL`): admitía «señal + entrega» sin porcentaje. Lo cazó un test | **Cerrado** (iteración 5) |
| A1-9 | 🟢 | Funciones de *trigger* con `EXECUTE` para `authenticated` (no explotable: Postgres no permite llamarlas fuera de un trigger) | **Cerrado** (iteración 5): revocado |
| A1-10 | 🟠 | El equipo de R3ZON entra **sin 2FA**. Es el acceso con más alcance (todos los clientes) | **Abierto**: tarea de la Fase 1 aparcada por decisión de R3ZON; obligatorio antes del primer cliente real. Cuando exista, las policies de staff exigirán `aal2` |
| A1-11 | 🟡 | Sin CSP (heredado de la plantilla) | **Abierto** (TAREAS_PENDIENTES) |
| A1-12 | 🟡 | Exportación, importación, bloqueo legal y registro de supresiones (RGPD) sin implementar | **Abierto**: diseño en [RGPD.md](RGPD.md), módulo `rgpd` antes del MVP |
| A1-13 | 🟢 | Un usuario puede ver los ids de sus compañeros de empresa (no nombres ni emails) | **Aceptado**: necesario para la pertenencia; los ids no identifican a nadie sin acceso a Auth |
| A1-14 | 🟢 | El login no tiene limitación de intentos propia (heredado: A1-3 de la plantilla) | **Aceptado**: se apoya en los límites de Supabase Auth; revisar al salir de local |

**Verificado y correcto.**

- Ningún UUID se usa como secreto; el token de invitación son 32 bytes aleatorios y solo
  se guarda su SHA-256.
- Mensajes de error que no revelan si un email tiene cuenta o invitación.
- Panel `/admin`: 307 al login sin sesión, 404 real para un cliente con sesión, y la RLS
  detrás.
- Las Server Actions no deciden permisos: los decide la base, porque una Server Action es
  un endpoint público más.
- Un fallo de un módulo no tumba la página: las consultas no lanzan y cada bloque está
  aislado (`ModuloSeguro`).
