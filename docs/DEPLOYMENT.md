# Despliegue a producción

Producción = **Vercel** (app) + **Supabase Cloud** (base de datos y auth). Esta guía es
la común a todos los productos; lo que añada un módulo (Stripe, Resend…) lo documenta su
README.

## Vista rápida

1. Supabase Cloud: crear el proyecto, aplicar las migraciones, configurar Auth.
2. Vercel: importar el repo y definir variables.
3. Sentry (opcional): proyecto y DSN.
4. Verificar sin cookie.
5. Dar de alta la documentación en el Docusaurus.

## 1. Supabase Cloud

1. **Crear el proyecto** en región UE (Fráncfort, junto a `fra1` de Vercel).
2. **Aplicar las migraciones** desde local, con el proyecto enlazado:
   ```bash
   npx supabase link --project-ref <REF>
   npx supabase db push --dry-run   # ver qué se aplicaría
   npx supabase db push
   ```
   En un proyecto que ya tiene producción, antes de cada `db push` compara con el esquema
   real ([DATABASE.md](DATABASE.md) → Producción) y pide autorización.
3. **Auth → URL Configuration**:
   - *Site URL*: `https://<dominio>`.
   - *Redirect URLs*: `https://<dominio>/**` y, si se usan previews, el patrón de las URLs
     de preview de Vercel.
4. **Auth → Providers → Email**: longitud mínima de contraseña **8** (igual que
   `supabase/config.toml`). Decidir si se exige confirmar el email; si sí, las plantillas
   de email deben apuntar a `https://<dominio>/auth/callback`.
5. **API keys**: copiar la *publishable key*. La *secret key* no va a Vercel: la app no la
   usa.

## 2. Vercel

1. Importar el repositorio. Framework: Next.js (detectado). Región: la de
   [`vercel.json`](../vercel.json) (`fra1`).
2. **Variables de entorno** (Production y Preview):

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key | No |
| `NEXT_PUBLIC_SITE_URL` | `https://<dominio>` (solo si difiere de `project.domain`) | No |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN del proyecto de Sentry (opcional) | No: es público por diseño, solo permite enviar eventos |
| `SENTRY_ORG` · `SENTRY_PROJECT` · `SENTRY_AUTH_TOKEN` | Para subir source maps (opcional) | El token, sí |

3. **Dominio**: añadir `<dominio>` y comprobar que coincide con
   [`src/config/project.ts`](../src/config/project.ts).

Cada push a `main` despliega a producción; cada PR crea un preview.

## 3. Sentry (opcional)

Crear un proyecto Next.js en la organización de R3ZON, región UE. Con el DSN definido,
Sentry arranca solo en los despliegues de Vercel; sin él, no se carga. Qué se recoge y
qué no: [STACK.md](STACK.md) → Observabilidad. El entorno se toma de
`NEXT_PUBLIC_VERCEL_ENV`, así que los errores de preview no se mezclan con los de
producción.

## 4. Verificación tras el despliegue

Sin cookie, desde fuera:

```bash
D=https://<dominio>
curl -sI $D/               | head -1   # 200
curl -sI $D/login          | head -1   # 200
curl -s  $D/api/health                 # {"status":"ok","release":"<sha>"}
curl -sI $D/inicio         | grep -iE '^(HTTP|location)'   # 307 → /login?redirect=%2Finicio
curl -sI $D/robots.txt     | head -1   # 200
```

Después, iniciar sesión con una cuenta de prueba y comprobar que `/inicio` muestra el
nombre del perfil (prueba de punta a punta de la RLS en producción).

(`/inicio` es el `homePath` de la plantilla: usa el de `src/config/project.ts`.)

## 5. Documentación pública

Si el producto publica su documentación, darlo de alta en
`R3ZON-Docusaurus/config/products.ts` (entrada de ejemplo en
[`public_docs/README.md`](../public_docs/README.md) §3). El Docusaurus lee `public_docs/`
de la rama indicada en cada build. Una app interna no se da de alta
([TEMPLATE.md](TEMPLATE.md) → Documentación al derivar).

## 6. Servicios propios de Excelsior

> **Previsto.** Se dan de alta en la Fase 0 en modo de pruebas y pasan a producción en el
> hito MVP ([PLAN.md](PLAN.md)). Cada variable nueva sigue
> [DEVELOPMENT.md](DEVELOPMENT.md) → «Añadir una variable de entorno» y se añade a la
> tabla del paso 2 al implementarse.

| Servicio | Qué configurar | Variables previstas |
|---|---|---|
| **Dominio** | `clientes.r3zon.com` en Vercel (CNAME en el DNS de r3zon.com); `project.domain` igual | — |
| **Supabase Auth** | *Site URL* `https://clientes.r3zon.com`; registro público **desactivado** o bloqueado por hook ([AUTH.md](AUTH.md) → Previsto); proveedor Google; SMTP de Resend; plantillas de email con la marca | — |
| **Supabase Storage** | Buckets privados (contratos, documentos) con límites de tamaño y tipo; plan con backups (decisión D-07) | — |
| **Google Cloud** | Proyecto OAuth, pantalla de consentimiento con la marca de R3ZON (verificada), URI de redirección de Supabase | En Supabase, no en Vercel |
| **Stripe** | Cuenta de R3ZON, métodos (transferencia, SEPA, tarjeta), Stripe Tax o tipos de IVA, Invoicing, endpoint de webhook `https://clientes.r3zon.com/api/stripe/webhook` | `STRIPE_SECRET_KEY` (secreta), `STRIPE_WEBHOOK_SECRET` (secreta), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Resend** | Dominio de envío de r3zon.com con SPF, DKIM y DMARC | `RESEND_API_KEY` (secreta) |
| **Vercel Cron** | Recordatorios de briefing y de pagos (Fase 5) | `CRON_SECRET` (secreta) |

En la verificación sin cookie (paso 4) se añaden `/invitacion/<token-falso>` → 200 con
el mensaje de enlace no válido, `/admin` → 307 al login, y `POST /api/stripe/webhook`
sin firma → 400.

## ¿Qué hago cuando algo falla en producción?

Por orden, de lo más rápido a lo más profundo:

1. **¿Responde la app?** `curl -s https://<dominio>/api/health`. Si responde
   `{"status":"ok","release":"<sha>"}`, la app está viva y `release` dice qué commit está
   sirviendo: compáralo con el último de `main`. Si no responde, el problema es de
   despliegue o de plataforma: paso 2.
2. **Vercel → Deployments.** ¿Falló el último build? Su log dice por qué. Si el fallo
   empezó con un despliegue, **Instant Rollback** al anterior y se investiga después.
   **Vercel → Logs** (Runtime Logs) muestra una línea JSON por evento del logger
   (`level`, `scope`, `event`); filtra por `level:error` o por el `scope` de la ruta
   afectada.
3. **Sentry → Issues** (si hay DSN configurado). Filtra por `environment:production` y
   por el `release` del paso 1. Trae el stack y la ruta, sin datos personales: para
   saber quién, cruza la hora y la ruta con los logs de Vercel.
4. **Supabase**, cuando el fallo huele a datos o a sesión (errores de permisos, 401,
   consultas vacías que no deberían estarlo):
   - **Logs → API / Postgres / Auth** del proyecto. Un `permission denied` o una fila que
     «desaparece» suele ser la RLS o un grant.
   - **Database → Migrations**: que producción tenga las mismas migraciones que el repo.
     Una migración sin aplicar explica un error tras un despliegue.
   - **Reports** para saturación (conexiones, CPU) y el estado del proyecto en
     status.supabase.com.
5. **Reproducirlo en local**: la misma ruta contra el Supabase local (`npm run db:reset`
   aplica exactamente las migraciones del repo). Si en local funciona y en producción no,
   la diferencia está en los datos, en las variables de entorno o en una migración que no
   se aplicó.

Al cerrar un incidente, una entrada en la bitácora con la causa y, si faltaba, el test
que lo habría cazado.

## Qué no incluye la plantilla (y por qué)

- **Workflow de migraciones a producción, drift contra producción y backups**: necesitan
  secretos de producción y decisiones de cada proyecto (quién aprueba, retención, plan de
  Supabase). Ver [mejoras.md](mejoras.md) y el módulo `backups`.
- **Crons de Vercel**: son de producto.
