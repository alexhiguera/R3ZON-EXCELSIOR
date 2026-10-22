# Base de datos

Supabase (PostgreSQL 17) es la base de datos, el sistema de autenticación y el motor de
seguridad (RLS). La app habla con ella **solo** a través de `supabase-js` con la sesión
del usuario.

## Qué hay en la base del core

Una sola tabla: **`public.profiles`**, 1:1 con `auth.users`
([migración](../supabase/migrations/20260923000000_core_profiles.sql)).

| Pieza | Qué hace |
|---|---|
| `profiles(id, display_name, created_at, updated_at)` | `id` es PK y FK a `auth.users` con `on delete cascade` |
| `profiles_display_name_length` | CHECK: nulo o entre 1 y 120 caracteres |
| `on_auth_user_created` → `handle_new_user()` | Crea el perfil al registrarse. `SECURITY DEFINER` con `search_path = ''`, sin `EXECUTE` para nadie |
| `profiles_set_updated_at` → `set_updated_at()` | Trigger genérico reutilizable por cualquier tabla |
| RLS `profiles_select_own` / `profiles_update_own` | Cada usuario ve y edita solo su fila |
| Grants | `anon`: nada. `authenticated`: `SELECT` y `UPDATE (display_name)` |
| Default privileges | Las funciones nuevas de `public` nacen sin `EXECUTE` para `PUBLIC` ni `anon` |

No guarda el email: ya está en `auth.users`, y duplicar un dato personal es duplicar lo
que hay que rectificar, exportar y borrar.

No hay índices adicionales: el de la PK cubre la FK.

## Qué hay en la base de Excelsior

Además del core:

| Migración | Qué añade |
|---|---|
| [`20261022120000_uuidv7.sql`](../supabase/migrations/20261022120000_uuidv7.sql) | `public.uuidv7()`: default de toda PK nueva (abajo) |
| [`20261022120100_organizations_invitations.sql`](../supabase/migrations/20261022120100_organizations_invitations.sql) | `profiles.platform_role`, `organizations`, `organization_members`, `invitations`, `audit_log`, funciones de permiso, hook de alta solo por invitación ([AUTH.md](AUTH.md)) |

| Pieza | Qué hace |
|---|---|
| `profiles.platform_role` | `client` · `staff` · `admin`. Sin grant de UPDATE: nadie se cambia el suyo; los cambios quedan en `audit_log` |
| `organizations` | Empresa cliente. `created_by` lo pone un trigger. La crea y edita el staff (RLS); la ven sus miembros |
| `organization_members` | Usuario ↔ empresa con rol `owner` · `member` · `billing`; N:M (T-13). Trigger: una empresa con propietario no se queda sin ninguno |
| `invitations` | Hash SHA-256 del token, caducidad, un desenlace (aceptada o revocada). Una sola abierta por email y empresa. Transiciones en trigger |
| `audit_log` | Lo escriben solo triggers `SECURITY DEFINER` (sin grants de escritura); lo lee el staff. Sin FK a la organización a propósito: el registro sobrevive a lo que describe |
| `is_staff()` · `is_admin()` · `is_org_member()` · `org_role_of()` | Funciones de permiso para las policies. Definer para no entrar en recursión; declaradas en el test de catálogo |

### UUIDv7

Decisión de R3ZON (2026-10-22): las claves primarias nuevas son **UUIDv7** (RFC 9562).
Postgres 17 no la trae (llega en Postgres 18) y Supabase no ofrece extensión, así que
`public.uuidv7()` la implementa en SQL con el **mismo nombre que la nativa**: al pasar a
Postgres 18 bastará una migración que cambie los defaults y la borre.

- **Por qué:** ordenan por fecha de alta, los B-tree insertan al final (menos
  fragmentación) y `order by id` equivale a orden de creación.
- **Contrapartida:** el id revela cuándo se creó la fila. Nunca es un secreto.
- **Excepción:** `auth.users.id` (y `profiles.id`) lo genera Supabase Auth como v4.
- **Vigilancia:** `security-catalog.test.ts` falla si una PK UUID con default no usa
  `uuidv7()`; `uuidv7.test.ts` comprueba versión, variante, hora y orden.

## Migraciones: la fuente de verdad

`supabase/migrations/` es el **único** sitio donde se define el esquema.

- Nombre: `YYYYMMDDHHMMSS_descripcion.sql` (`npx supabase migration new <descripcion>`).
- **Una migración aplicada en cualquier entorno compartido no se edita.** Lo que falte,
  en una migración nueva. Motivo: [ARCHITECTURE.md §2](ARCHITECTURE.md).
- Cada tabla nueva llega con RLS, policies por acción, grants mínimos, índices de sus FK
  y tests. El test de catálogo lo exige.

### Flujo al cambiar el esquema

```bash
npx supabase migration new mi_cambio   # escribe el SQL
npm run db:reset                        # aplica todo desde cero en local
npm run db:pull                         # regenera prisma/schema.prisma
npm run db:types                        # regenera src/lib/database.types.ts
npm run test:run                        # incluye los tests de BD
```

Migración, `schema.prisma` y tipos van **en el mismo commit**. CI aplica las migraciones
en una base nueva y ejecuta `npm run db:drift` y `npm run db:types:check`: si el schema o
los tipos no coinciden con lo que producen las migraciones, falla y dice qué lanzar. Así
una migración no puede entrar en `main` dejando atrás ninguno de los dos.

## Prisma: solo introspección, Studio y drift

| Sí | No, nunca |
|---|---|
| `npm run db:pull` — schema.prisma ← base local | `prisma db push` |
| `npm run db:drift` — ¿coinciden? (CI) | `prisma migrate *` |
| `npm run db:studio` — explorar la base local | Prisma Client dentro de la app |
| `npm run db:validate` | Editar `schema.prisma` a mano |

**Por qué no Prisma Migrate:** tendríamos dos fuentes del esquema. **Por qué no Prisma
Client en la app:** se conecta con un rol de base de datos que no pasa por la RLS de la
sesión del usuario; `supabase-js` sí.

Todos los comandos pasan por [`scripts/prisma-db.mjs`](../scripts/prisma-db.mjs), que:

- **solo acepta una base local** (se niega con cualquier otro host);
- introspecciona `public` + `auth` (sin `auth`, la FK a `auth.users` hace fallar la
  introspección con P4002) y luego se queda solo con `public`;
- en `drift`, sale con código 2 si hay diferencias y 1 si no pudo comparar.

[`prisma.config.ts`](../prisma.config.ts) no carga ningún `.env`: así un `npx prisma …`
suelto nunca usa una URL de producción que hubiera en disco.

El bloque `generator` de `schema.prisma` existe porque Prisma lo exige. El cliente
generado (`src/generated/`, ignorado por git) solo se genera si algún script local lo
necesita: `npx prisma generate` y añadir `@prisma/client`.

## Tipos de TypeScript

`npm run db:types` regenera [`src/lib/database.types.ts`](../src/lib/database.types.ts)
desde la base **local** (el resultado de las migraciones). Escribe el fichero solo si la
generación ha ido bien: con una redirección de shell, un fallo lo dejaría vacío.

`npm run db:types:check` regenera en memoria y compara con el fichero versionado, sin
escribir; sale con código 1 si difieren. Es el paso «Tipos» de CI. La salida es
reproducible porque la base sale siempre de las mismas migraciones y la CLI de Supabase
está fijada en el lockfile. Si se actualiza la CLI y cambia el formato de los tipos, el
check lo mostrará: basta con `npm run db:types` y commitear.

## Stack local

`npm run db:start` / `db:stop` / `db:reset` / `db:status`. La CLI de Supabase es una
devDependency, así que su versión es la del lockfile.

**Puertos propios por proyecto.** [`supabase/config.toml`](../supabase/config.toml) usa
en la plantilla el rango 5532x (API 55321, BD 55322, Studio 55323, Mailpit 55324), que
queda **reservado para la plantilla**. **Excelsior usa 5542x** (API 55421, BD 55422,
Studio 55423, Mailpit 55424). Cada producto de R3ZON elige el suyo al crearse,
para poder tener varios stacks levantados a la vez; `tests/unit/project.test.ts` falla si
un proyecto derivado conserva 55321 o 55322. Scripts,
tests y Playwright **leen el puerto de `config.toml`**
([`scripts/lib/supabase-local.mjs`](../scripts/lib/supabase-local.mjs)): no se escribe en
ningún otro sitio.

`edge_runtime` y `analytics` están apagados: el core no los usa y alargan el arranque.

## Tests de base de datos

`tests/db/` prueba contra Postgres real lo que ningún mock puede probar:

- [`profiles.test.ts`](../tests/db/profiles.test.ts) — trigger de alta, RLS por fila,
  grants por columna, CHECK, cascada, `updated_at`.
- [`security-catalog.test.ts`](../tests/db/security-catalog.test.ts) — reglas globales
  sobre todo el catálogo (ver [ARCHITECTURE.md §3](ARCHITECTURE.md)), incluida la de
  UUIDv7.
- [`organizations.test.ts`](../tests/db/organizations.test.ts),
  [`invitations.test.ts`](../tests/db/invitations.test.ts),
  [`uuidv7.test.ts`](../tests/db/uuidv7.test.ts) — Excelsior. Ayudas de dominio en
  [`_excelsior.ts`](../tests/db/_excelsior.ts).

**Un test de BD no puede suponer una base vacía**: los E2E y el desarrollo dejan datos.
Cada consulta se acota a las filas que crea el propio test (por id u organización).

Helpers en [`tests/db/_db.ts`](../tests/db/_db.ts):

- `inRollback(fn)` — cada test en una transacción que se deshace.
- `actAs(c, userId | null)` — cambia a `authenticated` (o `anon`) con los claims del JWT
  que pondría PostgREST, así `auth.uid()` funciona.
- `createAuthUser(c, …)` — inserta en `auth.users` y dispara los triggers reales.

**No pueden pasar en silencio:** con `CI=true` y sin base, fallan. En local se saltan con
aviso. Además comprueban que la base tiene `public.profiles` antes de tocar nada, para no
ejecutarse contra la base de otro proyecto.

## Producción

- Las migraciones se aplican con `npx supabase db push` **solo con autorización** y tras
  comparar con el esquema real (`npx supabase db dump --schema public -f <fichero>`):
  `db reset` en local no detecta que producción se haya desviado.
- La plantilla no incluye workflows que toquen producción (aplicar migraciones, drift
  contra producción, backups): dependen de secretos y decisiones de cada proyecto. Están
  descritos en [mejoras.md](mejoras.md) y en el módulo `backups`.
- Secretos por tenant o tokens de terceros, si llegan: cifrados en Postgres (pgcrypto,
  clave maestra en Vault), no en Node.

## Modelo de datos previsto en Excelsior

> **Previsto.** Ninguna de estas tablas existe todavía. Es el mapa para que las
> migraciones de cada fase encajen entre sí; los nombres y columnas definitivos los
> decide cada migración, y esta sección se actualiza al aplicarla.

```text
auth.users ─1:1─ profiles (+ nivel de plataforma: admin | staff | client)
                    │
                    └─N:M─ organization_members (rol: owner | member | billing) ─── organizations (cliente)
                                                                                       │
          invitations (token_hash, email, organization, service?, expires_at, used_at)─┤
                                                                                       ├─ organization_billing (razón social, NIF, dirección, firmante)
services ─< service_versions (precio, IVA, modalidades, plantilla de contrato y briefing)
                    │                                                                  │
                    └──────────────< engagements (contratación: estado, precio, modalidad) ─┘
                                         │
             ┌───────────────────────────┼──────────────────────────────┐
         contracts                   payments / invoices            projects
   (plantilla+versión, PDF,         (Stripe ids, estado,          (fase, fechas)
    hash, evidencias, firmado)       ref. factura emisor)              │
                                                         ┌─────────────┼──────────────┐
                                                  briefing_items    documents      tickets ─< ticket_messages
                                                  (tipo, valor,     (Storage)       (+ notas internas)
                                                   estado)
proposals ─< proposal_items  ──(aceptada)──► engagements
audit_log (quién, qué, cuándo, sobre qué organización)
```

| Fase | Tablas | Reglas que van en triggers (no en la app) |
|---|---|---|
| 1 ✅ | `organizations`, `organization_members`, `invitations`, `audit_log`; nivel de plataforma en `profiles` | Implementado (arriba, «Qué hay en la base de Excelsior») |
| 2 | `services`, `service_versions`, `engagements`, historial de estados | Una contratación apunta a una **versión** del servicio: cambiar el catálogo no altera lo contratado. Solo las transiciones de estado permitidas ([ARCHITECTURE.md](ARCHITECTURE.md) §20) |
| 3 | `organization_billing`, `contract_templates`, `contracts`, `contract_signatures`, `onboarding_progress` | Contrato firmado inmutable (sin `UPDATE` ni `DELETE`); solo un `owner` firma |
| 4 | `payments`, `refunds`, `invoices` (incluidas rectificativas), `stripe_events` | `stripe_events` deduplica webhooks por id; el estado «pagado» solo lo escribe el webhook; un evento antiguo no hace retroceder un estado |
| 5 | `projects`, `briefing_templates`, `briefing_items`, `documents` (+ policies de `storage.objects`) | Ruta del fichero con la organización; límites de tamaño; un fichero en cuarentena no es descargable |
| 6 | `proposals`, `proposal_items`, `subscriptions`, `notifications` | Propuesta aceptada no se edita; caducidad |
| 7 | `tickets`, `ticket_messages` | Notas internas invisibles para el cliente |

Toda tabla de negocio lleva `organization_id` rellenado por trigger a partir de su padre
(proyecto, contratación…), nunca por el cliente ([ARCHITECTURE.md](ARCHITECTURE.md) §5 y
§15).
