# Protección de datos (RGPD) y conservación

Cómo trata Excelsior los datos personales y qué falta para cumplir el RGPD
(Reglamento UE 2016/679) y la LOPDGDD. Este documento lo mantiene quien desarrolla; las
decisiones legales las valida la asesoría de R3ZON (decisión D-13 de [PLAN.md](PLAN.md)).
La revisión técnica de seguridad está en [auditoria.md](auditoria.md).

> Estado: **2026-10-23**. Solo local, sin datos reales (T-17). Lo marcado ✅ está
> implementado y probado; lo marcado ⬜ es diseño pendiente.

## 1. Papel de R3ZON

- **Responsable del tratamiento** de los datos de sus clientes y de las personas de esas
  empresas que usan el portal (cuentas, contratos, facturas, tickets).
- **Encargado del tratamiento** de los datos personales que los clientes suben para su
  proyecto (p. ej. datos de terceros en materiales) y de los que tratan las webs que
  R3ZON construye o mantiene: por eso el contrato de encargo (DPA) se firma en el
  onboarding cuando el servicio lo requiere (PLAN.md, Fase 3, decisión D-05).

## 2. Inventario de datos (hoy)

| Dato | Dónde | Base legal | Conservación | Estado |
|---|---|---|---|---|
| Email y contraseña (hash bcrypt) | `auth.users` (Supabase Auth) | Ejecución del contrato (art. 6.1.b) | Mientras haya relación + bloqueo legal | ✅ |
| Nombre visible | `profiles.display_name` | Ejecución del contrato | Igual que la cuenta | ✅ |
| Nivel en la plataforma | `profiles.platform_role` | Interés legítimo (seguridad) | Igual que la cuenta | ✅ |
| Pertenencia a empresa y rol | `organization_members` | Ejecución del contrato | Se borra con el usuario (dato de acceso) | ✅ |
| Email de una invitación | `invitations.email` | Medidas precontractuales (6.1.b) | **Purga** de invitaciones cerradas tras un plazo (≥ 90 días; definitivo en D-13) | ✅ función, ⬜ tarea programada |
| Nombre de la empresa | `organizations.name` | Ejecución del contrato | 6 años tras el fin de la relación | ✅ (se archiva, no se borra) |
| Contrataciones y su historial | `engagements`, `engagement_status_history` | Ejecución del contrato + obligación legal | **6 años** | ✅ (`on delete restrict`, sin `DELETE`) |
| Registro de actividad | `audit_log` | Interés legítimo (seguridad, rendición de cuentas, art. 5.2 y 32) | **6 años**, purga solo de lo anterior | ✅ |
| IP y agente en el login | Logs de Supabase Auth | Interés legítimo (seguridad) | Lo que retenga el plan de Supabase | ⬜ revisar plan |
| Datos fiscales de la empresa | `organization_billing` | Contrato + obligación legal (facturación) | 6 años | ✅ (`on delete restrict`) |
| Contrato firmado (texto y huella) | `contracts.signed_text`, `text_sha256` | Contrato + obligación legal | 6 años | ✅ inmutable |
| Evidencias de la firma: nombre, DNI/NIE, cargo, email, firma dibujada, IP, agente, momento de verificación del código | `contract_signatures` | Contrato + interés legítimo (prueba de la firma) | 6 años | ✅ inmutable, sin FK al usuario |
| Pagos, materiales, tickets | Fases 4–7 | Contrato + obligación legal | 6 años (facturas) | ⬜ |

**Sobre la firma dibujada:** es una imagen estática, no una firma biométrica (no se
captan presión, velocidad ni trazo para identificar a la persona), así que no es una
categoría especial de datos (art. 9). Si algún día se capturan esos datos, hay que
revisarlo.

**Minimización aplicada desde el diseño (art. 25):**

- El email **no se duplica**: vive solo en `auth.users`. El equipo lo ve con
  `organization_directory()`, que comprueba dentro que quien pregunta es del equipo.
- El registro de actividad **no guarda** emails, nombres, nombres de empresa ni tokens:
  solo ids, roles y estados. Un test lo comprueba (`tests/db/plataforma.test.ts`).
- El token de invitación **no se guarda**: solo su SHA-256. Tampoco en los metadatos de
  Auth (lo comprueba un E2E contra el Auth real).
- Un usuario cliente **no ve** los nombres ni los emails de sus compañeros de empresa
  (solo sus ids); se abrirá cuando haga falta (Fase 6), con su motivo.

## 3. Conservación: 6 años

Decisión de R3ZON (2026-10-23): la información se conserva **6 años**, el plazo del
Código de Comercio (art. 30) para la documentación mercantil, que cubre contratos y
facturas (y con holgura los 4 años de la normativa tributaria).

Cómo lo garantiza la base, desde el principio:

- **Nada con obligación de conservación se borra en cascada.** Contrataciones (y lo que
  venga: contratos, facturas) apuntan a la organización con `on delete restrict`. Solo
  los datos de acceso (miembros, invitaciones) se borran con ella. El test de catálogo
  falla si una tabla nueva rompe esta regla.
- **La organización se archiva, no se borra** (`archived_at`). La app no tiene permiso de
  `DELETE` sobre organizaciones ni contrataciones.
- **Registros inmutables:** `audit_log` y `engagement_status_history` rechazan `UPDATE`,
  `DELETE` y `TRUNCATE` incluso a `postgres` y `service_role`. El registro solo admite la
  purga de filas de **más de 6 años**, con una función que solo puede ejecutar
  `service_role` (para una tarea programada).

**Bloqueo legal** (art. 32 LOPDGDD): cuando una persona pide la supresión, sus datos
necesarios para obligaciones legales no se borran, sino que se **bloquean** (solo
accesibles para atender reclamaciones o requerimientos) hasta que vence el plazo. ⬜ Se
implementará con el ciclo de vida (hito MVP, D-13).

## 4. Derechos de los interesados

| Derecho | Cómo se atenderá | Estado |
|---|---|---|
| Acceso (art. 15) y portabilidad (art. 20) | **Exportación** en formato estructurado y legible por máquina: un ZIP con JSON (y CSV para tablas) de todo lo de la persona o de la empresa, más sus documentos | ⬜ módulo `rgpd`, antes del MVP |
| Importación | Cargar una exportación de Excelsior (traslado entre cuentas o restauración de una empresa archivada): valida el formato y la versión, y pasa por las mismas funciones y triggers que el alta normal, nunca por inserciones directas | ⬜ módulo `rgpd` |
| Rectificación (art. 16) | El nombre lo cambia la propia persona; los datos fiscales, desde «Mi empresa» (Fase 3) | 🚧 |
| Supresión (art. 17) | Se borra la cuenta (`auth.users`): se borran en cascada perfil y pertenencias; el registro conserva un id que ya no apunta a nadie (seudonimizado). Lo que tenga obligación legal queda bloqueado (§3) | 🚧 cascada ✅, bloqueo ⬜ |
| Limitación y oposición (arts. 18 y 21) | Archivado de la empresa y de la cuenta | ⬜ |

Diseño previsto del módulo `rgpd` (se apunta en [MODULES.md](MODULES.md)):

- La exportación se genera en el **servidor** con la sesión del propio interesado (o del
  staff para una empresa), así que **la RLS decide qué entra**: nadie puede exportar lo
  que no puede leer. Queda en el registro de actividad.
- Formato versionado (`excelsior-export/v1`) con un manifiesto (qué tablas, cuántas
  filas, hash de cada fichero), para que la importación pueda rechazar un fichero
  manipulado o de una versión incompatible.
- La importación nunca escribe ids ni campos que pone la base (`created_by`,
  estados…): reconstruye a través de las funciones de la app, para que se apliquen las
  mismas reglas que a cualquier otra escritura.

## 5. Copias de seguridad durante 6 años

Decisión de R3ZON: habrá backups que guarden la información **6 años**. Lo que implica
(detalle técnico en [RESTAURACION.md](RESTAURACION.md)):

- **Cifradas** y en la **UE**, con acceso restringido y registrado.
- Incluyen Storage (contratos firmados, materiales), no solo la base.
- **Supresión y backups:** no se reescriben backups antiguos para borrar a una persona
  (no es razonable ni lo exige la AEPD si se garantiza lo siguiente). Se mantiene un
  **registro de supresiones** y, si un backup se restaura, se vuelven a aplicar antes de
  usar los datos. ⬜ Tabla y procedimiento con el módulo `backups`.
- Pasados los 6 años, los backups se destruyen.

## 6. Encargados y transferencias

Todos con contrato de encargo (DPA) y datos en la UE:

| Proveedor | Para qué | Región | Estado |
|---|---|---|---|
| Supabase | Base de datos, Auth, Storage | UE (Fráncfort) | ⬜ al salir de local |
| Vercel | Hosting de la app | `fra1` (UE) | ⬜ al salir de local |
| Stripe | Cobros y facturas | UE / SCC | ⬜ Fase 4 |
| Resend | Emails | Región UE | ⬜ al salir de local |
| Sentry | Errores (sin datos personales: `beforeSend` los quita) | UE | ⬜ al salir de local |
| Google | Login con Google (solo si el usuario lo elige) | — | ⬜ |

## 7. Medidas de seguridad (art. 32)

Resumen; el detalle y su verificación están en [auditoria.md](auditoria.md):

- **Compartimentación por cliente en la base** (RLS en todas las tablas, policies por
  acción, grants mínimos por columna) probada contra Postgres real.
- **Mínimo privilegio** para el equipo: `staff` gestiona clientes; solo `admin` toca
  catálogo y precios.
- **Trazabilidad** inmutable de las acciones sensibles.
- **Contraseñas** de 12 caracteres como mínimo y reautenticación para cambiarlas; 2FA
  obligatorio para el equipo (⬜ Fase 1).
- **Cifrado** en tránsito (HTTPS, HSTS) y en reposo (Supabase).
- **Sin secretos ni datos personales en logs** (logger y Sentry los redactan).

## 8. Pendiente antes del primer cliente real

- [ ] Registro de actividades de tratamiento (art. 30) y análisis de riesgos; valorar
      si hace falta EIPD (art. 35) (asesoría).
- [ ] Política de privacidad y aviso legal del portal (hito MVP).
- [ ] Módulo `rgpd`: exportación, importación, bloqueo y supresión.
- [ ] Tareas programadas de purga (invitaciones, registro > 6 años).
- [ ] Backups con registro de supresiones y simulacro de restauración.
- [ ] Procedimiento de brechas de seguridad (notificación a la AEPD en 72 h, art. 33).
