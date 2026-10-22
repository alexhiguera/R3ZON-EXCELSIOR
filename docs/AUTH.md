# Autenticación y sesión

El core trae la autenticación **mínima** que necesita cualquier producto: sesión, login
con email y contraseña, callback, logout y protección de rutas. Registro, OAuth, 2FA,
recuperación de contraseña y onboarding son el módulo `auth-advanced`.

> **Excelsior** sustituye el «registro público» por **alta solo por invitación**, con
> email + contraseña o Google. Lo que hay hoy es el core; lo previsto está al final, en
> [«Previsto en Excelsior»](#previsto-en-excelsior) ([PLAN.md](PLAN.md) → Fase 1).

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
- Prefijos (por segmento): `/auth`, `/legal`.

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

## Registro de usuarios

El core no tiene página de registro: los usuarios se crean desde el panel de Supabase, por
invitación o con `npm run seed:dev` en local. El registro público llega con
`auth-advanced`, porque implica decisiones de producto (confirmación de email,
consentimiento legal, onboarding).

## Recuperación de contraseña

**No está en el core en v1.0: permanece en `auth-advanced`.** El motivo y qué hacer
mientras tanto (restablecerla desde el panel de Supabase) están en
[`modules/README.md`](../modules/README.md) → «Decisión sobre la recuperación de
contraseña». El callback del core ya acepta `type=recovery`, así que el módulo solo
tendrá que añadir las páginas.

## Alta de usuarios

Al crearse un usuario, por cualquier vía, el trigger `on_auth_user_created` crea su fila
en `public.profiles` con el `display_name` de sus metadatos
([DATABASE.md](DATABASE.md)).

## Tests

- Unitarios: [`public-paths.test.ts`](../tests/unit/public-paths.test.ts),
  [`safe-redirect.test.ts`](../tests/unit/safe-redirect.test.ts).
- E2E: [`e2e/specs/auth.spec.ts`](../e2e/specs/auth.spec.ts) — pública 200, protegida 307
  al login con el destino, login correcto e incorrecto, logout, y que `?redirect=` no saca
  del sitio.

## Previsto en Excelsior

> **Previsto (Fase 1).** Nada de esto existe todavía. Al implementarlo, esta sección pasa
> a describir el estado real y las de arriba se actualizan.

### Alta solo por invitación

```text
Staff R3ZON ──► crea invitación (email, organización, [servicio])
                  └─ token aleatorio; en la base solo su hash, con caducidad y un solo uso
                        │
Invitado ──► /invitacion/<token> (pública)
               ├─ token inválido, caducado, revocado o usado ──► mensaje, sin formulario
               └─ válido ──► «Crear cuenta con email y contraseña»  ó  «Continuar con Google»
                                └─ cuenta creada ──► miembro de la organización ──► onboarding
```

- **No existe registro sin invitación**, ni en la interfaz ni en el servidor. El bloqueo
  real está en Supabase Auth (*before user created hook* o `signups` deshabilitados +
  alta en servidor), porque con OAuth cualquiera puede intentar crear usuario desde
  Google sin pasar por nuestras páginas. Un E2E lo intenta.
- El email de la cuenta debe coincidir con el de la invitación (decisión D-02 de
  [PLAN.md](PLAN.md)).
- Aceptar la invitación es atómico: crea la pertenencia a la organización, marca la
  invitación como usada y registra el evento en el audit log.

### Login, Google y contraseñas

- `/login`: email + contraseña y «Continuar con Google». Sin enlace de registro.
- **Google** (OAuth de Supabase): un usuario existente puede vincular su cuenta de Google
  desde «Mi cuenta». Si alguien entra con Google con un email sin cuenta ni invitación,
  se rechaza con un mensaje que no revela si el email es cliente.
- **Recuperación de contraseña**: `/recuperar` envía el enlace (mismo mensaje exista o no
  el email) → `/auth/callback?type=recovery` (el callback ya lo acepta) → página de nueva
  contraseña.
- **Cambio de contraseña** en «Mi cuenta», pidiendo la actual. Opción de cerrar las demás
  sesiones.
- **2FA (TOTP)** obligatorio para el staff, opcional para clientes.
- Emails de Auth con la marca de R3ZON, enviados por Resend como SMTP de Supabase.

### Rutas públicas que se añadirán

`/invitacion/[token]`, `/recuperar` y las páginas legales bajo `/legal` (el prefijo ya es
público). Cada una con su caso en `tests/unit/public-paths.test.ts` y comprobación con
`curl` sin cookie.

### Zonas con sesión

- `(app)/…` para usuarios de cliente.
- `(app)/admin/…` solo staff: el proxy y el layout redirigen a quien no lo sea, y la RLS
  es la barrera real ([ARCHITECTURE.md](ARCHITECTURE.md) §16).
- Un usuario con el onboarding a medias entra al paso pendiente en vez de a `homePath`.
