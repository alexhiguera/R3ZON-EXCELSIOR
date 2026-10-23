# Autenticación y sesión

El core trae la autenticación **mínima** que necesita cualquier producto: sesión, login
con email y contraseña, callback, logout y protección de rutas. Sobre él, Excelsior añade
el **alta solo por invitación** (con email y contraseña o con Google), las empresas
cliente y los niveles del equipo de R3ZON ([PLAN.md](PLAN.md) → Fase 1).
Recuperación y cambio de contraseña, «Mi cuenta», 2FA y emails con la marca llegan en
lo que queda de la Fase 1 ([«Pendiente»](#pendiente-de-la-fase-1)).

## Flujo

```text
Petición ──► src/proxy.ts ──► lib/supabase/proxy.ts (updateSession)
               │
               ├─ ruta pública (public-paths.ts) ──────────► pasa, sin llamar a Supabase
               ├─ /api/* ──────────────────────────────────► pasa: el handler responde 401 si hace falta
               ├─ sin cookie sb-* ─────────────────────────► 307 /login?redirect=<ruta>
               └─ getUser() (renueva el token si toca)
                     ├─ sin usuario ───────────────────────► 307 /login?redirect=<ruta>
                     └─ con usuario ───────────────────────► pasa, con las cookies renovadas
```

1. **Login** — [`(auth)/login/actions.ts`](../src/app/(auth)/login/actions.ts): Server
   Action que valida con Zod, llama a `signInWithPassword` y redirige a `?redirect=`
   (pasado por `safeRedirectPath`) o a `project.homePath`. El error es el mismo para
   «no existe» y «contraseña incorrecta», para no revelar qué emails tienen cuenta.
2. **Zona con sesión** — [`(app)/layout.tsx`](../src/app/(app)/layout.tsx) vuelve a
   comprobar el usuario. Es la segunda línea: si una ruta de `(app)` acabara por error en
   la lista pública, seguiría sin renderizarse para un anónimo.
3. **Callback** — [`auth/callback/route.ts`](../src/app/auth/callback/route.ts): destino
   de los enlaces que envía Supabase Auth (confirmación, invitación, recuperación). Acepta
   `?code=` (PKCE) y `?token_hash=&type=`. Redirige a `?next=`, solo dentro del sitio.
4. **Logout** — [`auth/logout/route.ts`](../src/app/auth/logout/route.ts): **solo POST**
   (un GET se podría disparar desde una `<img>` de otra web) y responde 303 al login.

## Rutas públicas

[`src/lib/public-paths.ts`](../src/lib/public-paths.ts):

- Exactas: `/`, `/login`, `/robots.txt`, `/sitemap.xml`, `/api/health`.
- Prefijos (por segmento): `/auth`, `/legal`, `/invitacion`.

Todo lo demás exige sesión, incluidas las rutas que no existen (`/admin` → 307): un
anónimo no puede averiguar qué rutas existen por la diferencia entre 404 y 307.

Para añadir una página pública: la página, su entrada en `public-paths.ts`, su caso en
[`tests/unit/public-paths.test.ts`](../tests/unit/public-paths.test.ts) y la comprobación
con `curl` sin cookie ([`CLAUDE.md`](../CLAUDE.md) §10).

## Clientes de Supabase

| Fichero | Dónde | Notas |
|---|---|---|
| [`lib/supabase/server.ts`](../src/lib/supabase/server.ts) | Server Components, Server Actions, Route Handlers | `getCurrentUser()` memoizado por render; usa `getUser()`, que valida el token, no `getSession()` |
| [`lib/supabase/client.ts`](../src/lib/supabase/client.ts) | Client Components | |
| [`lib/supabase/proxy.ts`](../src/lib/supabase/proxy.ts) | Proxy | No meter código entre crear el cliente y `getUser()` |

Los tres usan la **publishable key** y la sesión del usuario: todo pasa por RLS. La
`service_role` no se usa en la app.

## Rutas de API

El proxy no las redirige: un 307 a una página HTML no le sirve a quien llama a una API.
**Cada handler que necesite sesión la comprueba** con `getCurrentUser()` y responde 401.
Hoy solo existe `/api/health`, pública.

## Alta solo por invitación

No existe registro libre, **ni en la interfaz ni en el servidor**. Una cuenta nace de
una invitación de R3ZON ([PRODUCTO.md](PRODUCTO.md) §4). Implementado en
[`20261023000400_invitaciones.sql`](../supabase/migrations/20261023000400_invitaciones.sql).

```text
Staff (o `npm run dev:invitar` en local)
  └─ create_invitation(organización, email, rol) ──► token de 32 bytes, devuelto UNA vez;
                                                      en la base solo su SHA-256, 7 días
Invitado ──► /invitacion/<token> (pública, sin consultar nada a la base)
              ├─ formato incorrecto ─────────────────────────► «Enlace no válido»
              ├─ con sesión ──► «Aceptar invitación» ─► accept_invitation(token)
              └─ sin sesión ──► «Crear mi cuenta» (nombre, email, contraseña)
                                │   signUp con el token en los metadatos
                                └─ «Continuar con Google» (si está activo)
Supabase Auth ──► hook before_user_created ──► sin invitación válida: 403
              ──► alta del usuario + trigger: pertenencia + invitación aceptada (1 transacción)
```

**Dónde está cada barrera** (todas en la base, ninguna en la interfaz):

| Pieza | Qué hace |
|---|---|
| Hook `hook_before_user_created` | Corre antes de crear cualquier usuario. **Email y contraseña**: exige el token en los metadatos, y que sea de una invitación pendiente y vigente **para ese email** (tener el token prueba que se controla el email al que se envió). **Google**: basta una invitación pendiente para ese email, porque Google ya ha verificado que el email es suyo. Cualquier otro proveedor, rechazado. Mensaje único: no revela si un email tiene invitación |
| Trigger `strip_invitation_token` | El token no se guarda: lo quita de `auth.users.raw_user_meta_data` y de `auth.identities.identity_data`, en INSERT y en UPDATE (Supabase Auth escribe en los dos sitios; un E2E lo comprueba contra el Auth real) |
| Trigger `on_auth_user_created_accept_invitations` | En la misma transacción del alta, acepta las invitaciones pendientes de ese email y crea la pertenencia con su rol. Sin carreras ni estado intermedio |
| Trigger `invitations_guard_transition` | Una invitación no se edita; aceptada o revocada es definitivo; no se acepta caducada, revocada ni **con otro email**. Vale para toda vía: RPC, trigger, panel, script |
| RPC `accept_invitation` | Para una cuenta que ya existe (usuario en varias empresas, T-13). Bloquea la fila (`for update`) |

**Por qué la página no consulta la invitación antes del alta.** Hacerlo sin sesión
exigiría una función ejecutable por `anon`, y el catálogo de seguridad no admite
ninguna. La validez la decide la base en el alta (hook) o en la aceptación (trigger), y
el mensaje de error dice qué hacer. La bienvenida con la empresa y el servicio llega ya
con sesión (Fase 3).

**Por qué no hace falta confirmar el email.** El token llegó a ese email: tenerlo ya
prueba que es suyo, y con Google lo prueba Google. Por eso `enable_confirmations` está
desactivado, también en Cloud ([DEPLOYMENT.md](DEPLOYMENT.md)). Activarlo no rompe nada
(la app avisa de que revise su email), pero añade un paso sin añadir seguridad.

**Quién puede saltarse el hook.** Solo la API de administración de Supabase Auth (clave
`service_role`) y el panel de Supabase: los usa R3ZON, nunca la app (la `service_role` no
entra en el código). `npm run seed:dev` y `seed:e2e` crean así sus usuarios en local.

**Mensajes.** Con contraseña, cualquier rechazo del hook se muestra como «No hemos podido
usar esta invitación…» con qué hacer; un email que ya tiene cuenta lleva a iniciar
sesión. Con Google, el callback vuelve a `/login?error=oauth` con el aviso de entrar
desde la invitación.

## Contraseñas

- **12 caracteres como mínimo** (T-19), en Supabase Auth (`minimum_password_length`) y en
  el formulario ([`src/lib/auth/politica.ts`](../src/lib/auth/politica.ts)); un test
  comprueba que coinciden. Referencia: NIST SP 800-63B pide 15 si la contraseña es el
  único factor y 8 con segundo factor.
- **Cambiarla exige sesión reciente** (`secure_password_change = true`).
- Ambas cosas hay que replicarlas en el panel de Supabase Cloud al salir de local.

## Código por email (confirmar acciones)

Para firmar un contrato, la sesión tiene que haber verificado un código de un solo uso
enviado al email de la cuenta (`signInWithOtp` con `shouldCreateUser: false` y
`verifyOtp`). Supabase Auth deja constancia en el JWT (claim `amr`, método `otp`) y la
base lo comprueba al firmar (`session_otp_verified_at`). Plantilla del email:
[`supabase/templates/codigo.html`](../supabase/templates/codigo.html) (`magic_link` en
`config.toml`; en Cloud se copia en el panel → Email Templates → Magic Link). En local
llega a Mailpit.

## Google

- Botón «Continuar con Google» en el login y en la invitación, **solo si**
  `NEXT_PUBLIC_AUTH_GOOGLE=true` ([`src/lib/env.ts`](../src/lib/env.ts)). Sin la variable
  no aparece, para no ofrecer un botón que lleve a un error.
- El proveedor se configura en Supabase: en local, `[auth.external.google]` de
  [`supabase/config.toml`](../supabase/config.toml) (apagado hasta tener credenciales;
  pasos en [DEVELOPMENT.md](DEVELOPMENT.md)); en Cloud, el panel.
- **Aún no se ha probado con una cuenta real de Google**: el hook y el alta están
  probados contra Postgres con eventos de proveedor `google`, pero el viaje completo
  necesita un cliente OAuth de Google Cloud. Tarea abierta en
  [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

## Pendiente de la Fase 1

- **Recuperación de contraseña**: `/recuperar` (mismo mensaje exista o no el email) →
  `/auth/callback?type=recovery` (el callback ya lo acepta) → nueva contraseña.
- **«Mi cuenta»**: nombre, cambio de contraseña pidiendo la actual, vincular Google.
- **2FA (TOTP)** obligatorio para el staff.
- **Emails con la marca** (invitación incluida): hoy el enlace de invitación se copia a
  mano (`npm run dev:invitar`). Requiere Resend, fuera de alcance mientras todo es local.
- **Cerrar sesión**: hoy `signOut()` cierra todas las sesiones del usuario; decidir si
  solo la actual (tarea aparcada).

## Alta de usuarios

Al crearse un usuario, por cualquier vía, el trigger `on_auth_user_created` crea su fila
en `public.profiles` con el `display_name` de sus metadatos, y nivel `client`
([DATABASE.md](DATABASE.md)). Para hacer staff a alguien en local:
`npm run dev:staff -- <email> [admin|staff]`. En producción lo hace un admin
([ROLES.md](ROLES.md)).

## Zonas con sesión

- `(app)/…` para todos los usuarios. La navegación depende del nivel (cliente o equipo),
  pero lo que cada uno lee lo decide la RLS ([ARCHITECTURE.md](ARCHITECTURE.md) §16).
- `(app)/admin/…` (Fase 2) solo staff: proxy y layout redirigen, la RLS es la barrera.

## Tests

- Unitarios: [`public-paths.test.ts`](../tests/unit/public-paths.test.ts),
  [`safe-redirect.test.ts`](../tests/unit/safe-redirect.test.ts),
  [`invitaciones.test.ts`](../tests/unit/invitaciones.test.ts) (formato del token y
  mensajes).
- BD: [`invitations.test.ts`](../tests/db/invitations.test.ts) — creación solo por staff,
  hash y no token, reenvío, hook con cada proveedor y cada estado, alta que acepta,
  token no guardado, aceptación con cuenta existente, email equivocado, transiciones.
- E2E: [`auth.spec.ts`](../e2e/specs/auth.spec.ts) (login, logout, rutas) e
  [`invitacion.spec.ts`](../e2e/specs/invitacion.spec.ts) — alta con invitación hasta
  ver su empresa, email distinto, enlace usado, enlace mal formado, cuenta existente que
  acepta otra empresa, alta directa contra la API de Auth rechazada (403) y login sin
  «crear cuenta». En escritorio y en móvil.
