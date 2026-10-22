# Auditorías de seguridad

Registro de revisiones de seguridad: qué se revisó, qué se encontró y en qué estado está
cada hallazgo. Las revisiones nuevas van **arriba**.

Formato de un hallazgo: `ID` · severidad (🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja) ·
estado (**abierto** / **cerrado** en la iteración N / **aceptado** con su motivo).

---

## Auditoría 1 — *2026-09-23* — Revisión inicial de la plantilla

**Alcance.** Todo el core en su primera versión: proxy y gate de rutas, login, callback,
logout, clientes de Supabase, migración de `profiles`, grants y default privileges,
Sentry, logger, cabeceras HTTP y CI.

**Qué se comprobó y cómo.**

- RLS, grants, triggers y default privileges: con tests contra Postgres real
  (`tests/db/`), incluido un test de catálogo que se aplicará a toda tabla futura.
- Gate de rutas y redirecciones: tests unitarios y E2E contra el build de producción.
- Datos personales en Sentry y logs: tests de `redact()` y `scrubEvent()`.
- Dependencias: `npm audit` (0 vulnerabilidades tras los overrides de STACK.md).

### Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| A1-1 | 🟠 | Los default privileges con `in schema public` no retiraban el `EXECUTE` de `PUBLIC`: en PostgreSQL los privilegios por esquema solo pueden añadir sobre los globales. `anon` seguía pudiendo ejecutar toda función nueva a través de `PUBLIC`. Lo detectó el test de sonda del catálogo antes de que existiera ninguna RPC | **Cerrado** (iteración 1): revocación global `for role postgres` + test que lo vigila |
| A1-2 | 🟡 | No hay Content-Security-Policy. Sí hay `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS | **Abierto**: depende de los terceros de cada producto ([mejoras.md](mejoras.md)) |
| A1-3 | 🟢 | El login no tiene limitación de intentos propia: se apoya en los límites de Supabase Auth (`[auth.rate_limit]` en local, panel en Cloud) | **Aceptado**: suficiente para el core. Si un producto necesita más, se añade con el módulo que lo requiera |
| A1-4 | 🟢 | Los errores del navegador anteriores a la carga diferida de Sentry no se reportan | **Aceptado** (ver [mejoras.md](mejoras.md)): coste frente a 80 KB en el bundle inicial |
| A1-5 | 🟢 | Speed Insights arranca sin banner de consentimiento. No usa cookies ni identificadores, pero es una decisión legal de cada producto | **Aceptado** en la plantilla; cada producto lo revisa con su política de privacidad ([STACK.md](STACK.md)) |

**Verificado y correcto.**

- Redirecciones abiertas: `safeRedirectPath` rechaza URLs absolutas, `//host`, `/\host`,
  caracteres de control y `@host` (tests unitarios + E2E).
- Logout solo por POST (no se puede forzar desde una `<img>`).
- Mensaje de error de login único: no revela qué emails existen.
- Rutas inexistentes sin sesión devuelven 307, no 404: no se puede enumerar qué existe.
- `handle_new_user` (SECURITY DEFINER): `search_path` vacío y sin `EXECUTE` para nadie.
- `profiles`: `authenticated` solo puede actualizar `display_name`; no puede insertar ni
  tocar `id` ni fechas.
- Sin secretos en el repo; `.env*` ignorados salvo `.env.example`; Claude no puede leer
  `.env.local`.
