# `modules/` — módulos opcionales

La plantilla trae solo el **core**: lo que todo producto de R3ZON necesita desde el
primer día. Lo que solo necesitan algunos productos se añade como **módulo**.

Un módulo es un paquete de cambios (código, migraciones, tests y documentación) que se
**copia a mano** a un proyecto cuando ese proyecto lo necesita. No hay sistema de
plugins, ni CLI, ni paquetes npm internos: la primera versión es deliberadamente simple.
Si algún día copiar a mano se vuelve un problema real y repetido, será el momento de
automatizarlo; no antes.

> **Estado actual: no hay ningún módulo implementado.** Esta carpeta define el contrato
> y el catálogo. Cada módulo se construirá la primera vez que un producto real lo
> necesite, a partir de su implementación en ese producto.

---

## Por qué separarlos del core

- **El core se mantiene pequeño y verdadero.** Todo lo que está en el core se usa en
  todos los productos. Si algo está ahí «por si acaso», nadie lo mantiene y acaba
  mintiendo.
- **Un producto no paga por lo que no usa.** Ni en dependencias, ni en migraciones, ni
  en superficie de ataque, ni en documentación que leer.
- **La regla para decidir** es la de la plantilla: ¿esto facilita que R3ZON cree cinco
  SaaS distintos trabajando igual? Si sí, core. Si solo lo necesitan algunos, módulo.
  Si es una dependencia más un patrón de uso, **receta** (ver abajo), no módulo.

## Contrato de un módulo

Cuando un módulo exista, vivirá aquí con esta forma:

```text
modules/<nombre>/
├── README.md        ← obligatorio: qué resuelve, requisitos, cómo se instala y se quita
├── manifest.json    ← solo si llega a hacer falta (ver abajo)
├── src/             ← ficheros que se copian a src/ del proyecto, con la misma ruta
├── migrations/      ← migraciones SQL que se copian a supabase/migrations/
├── tests/           ← tests que se copian a tests/ (incluidos los de BD si toca la base)
└── docs/            ← fragmentos de documentación para docs/ y, si aplica, public_docs/
```

El `README.md` de cada módulo debe responder, como mínimo:

1. **Qué resuelve y cuándo NO usarlo.**
2. **Dependencias**: paquetes npm (con su motivo), servicios externos y cuentas, y
   **otros módulos** que necesita.
3. **Variables de entorno** que añade, siguiendo
   [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md) → «Añadir una variable de entorno».
4. **Migraciones**: qué tablas, funciones y policies crea. Toda tabla nueva llega con
   RLS, policies por acción, grants mínimos, índices de sus FK y tests. El test de
   catálogo del core vigila parte de esto (RLS, grants a `anon`, FK, funciones
   `SECURITY DEFINER`); las policies y los tests los revisa quien lo instala.
5. **Pasos de instalación**, en orden, incluida la regeneración de
   `prisma/schema.prisma` (`npm run db:pull`) y de los tipos (`npm run db:types`).
6. **Qué documentación toca**: secciones de `docs/`, reglas nuevas para `CLAUDE.md` y,
   si el usuario lo ve, páginas de `public_docs/`.
7. **Cómo se desinstala**, o por qué no se puede sin una migración de retirada.

### Reglas

- **Un módulo no modifica el core por dentro.** Se engancha por los puntos de extensión
  que ya existen: rutas nuevas en `src/app/`, entradas en `src/lib/public-paths.ts`,
  migraciones nuevas, componentes nuevos. Si un módulo necesita cambiar el core, ese
  cambio se discute como cambio del core, se hace en la plantilla y se documenta.
- **Las migraciones de un módulo se renombran con la fecha de instalación** al copiarlas
  al proyecto, para que se apliquen después de las que ya existan. Una vez aplicadas,
  no se editan (CLAUDE.md → Migraciones).
- **Al instalar un módulo, el proyecto lo apunta** en `docs/MODULES.md` (qué módulo, de
  qué versión de la plantilla según `r3zon-template.json` y qué se adaptó) y en la
  bitácora (`docs/CHANGELOG.md`).
- **`manifest.json` no se crea hasta que haga falta.** Cuando dos o tres módulos
  existan y se vea qué datos se repiten (dependencias, variables, orden de migraciones),
  se decide su formato. Inventarlo antes sería diseñar para un caso imaginario.

## Catálogo

Leyenda: ⬜ **candidato** — identificado en el análisis del proyecto de origen o en otro
producto de R3ZON, sin implementar · 📝 **documentado** — contrato escrito, sin código ·
✅ **implementado**.

A fecha de esta versión **todos son candidatos (⬜)**.

| Módulo | Qué aportaría | Depende de | Notas |
|---|---|---|---|
| `multi-tenancy` | Tabla de tenant (organización), miembros, trigger que rellena `tenant_id`, RLS por pertenencia, selector de tenant | — | Los principios (RLS + trigger, el frontend no filtra por tenant) ya son core: docs/ARCHITECTURE.md |
| `roles-permissions` | Matriz recurso × acción por miembro, un trigger de permiso por tabla, hooks de UI | `multi-tenancy` | El modelo de 3 dimensiones está en docs/ROLES.md |
| `billing-stripe` | Checkout, Customer Portal, webhooks idempotentes con versión de API fijada, planes y límites aplicados por trigger | normalmente `multi-tenancy` | Reintroduciría `plan_minimo` en el contrato de `public_docs` si el producto lo necesita |
| `email-resend` | Envío transaccional con Resend + plantillas react-email, lista de supresiones, webhook de rebotes | — | Los emails de Auth ya los envía Supabase sin este módulo |
| `auth-advanced` | Recuperación de contraseña, registro público, OAuth/SSO, 2FA (TOTP) y onboarding | — | Ver «Decisión sobre la recuperación de contraseña» |
| `whats-new` | `novedades.ts` + aviso de entrada con lo que ha cambiado, acumulado, una vez por persona | — | La REGLA de anunciar cambios visibles ya está en CLAUDE.md |
| `legal-consent` | Páginas legales versionadas, aceptación registrada, re-aceptación ante cambios materiales, banner de consentimiento | `auth-advanced` (registro) | `/legal` ya está reservado como prefijo público |
| `backups` | Backup diario de BD y Storage, retención, vigilancia, simulacro mensual de restauración | — | Imprescindible en el plan Free de Supabase (sin backups nativos). Ver docs/RESTAURACION.md |
| `file-storage` | Buckets con política documentada (público/privado por decisión), subida y firma de URLs | — | |
| `audit-log` | Registro de acciones sensibles consultable por el propietario de la cuenta | — | |
| `i18n` | Interfaz en varios idiomas: rutas o dominio por idioma, textos fuera de los componentes, `public_docs/` traducido como árbol espejo | — | El core es monoidioma (`project.locale` no traduce). La web corporativa de R3ZON ya usa `next-intl` |
| `mobile-capacitor` | App Android/iOS con Capacitor | — | Exige elegir la estrategia cliente/servidor (abajo) |
| `desktop-electron` | App de escritorio, auto-actualización | — | Exige elegir la estrategia cliente/servidor (abajo) |
| `in-app-help` | Ayuda contextual dentro de la app enlazada a `public_docs/`, y medición de divergencia entre ambas | — | |
| `public-api-webhooks` | API pública con claves por tenant y webhooks salientes con reintentos | `multi-tenancy` | Prioridad baja: solo si un producto la pide |

Añadir un candidato al catálogo requiere haberlo visto necesario en un producto real,
no imaginarlo.

### Decisión sobre la recuperación de contraseña

**En v1.0, la recuperación de contraseña permanece en `auth-advanced`.** Casi todo
producto con login por contraseña acabará necesitándola, pero implementarla bien
implica decisiones de producto:

- el diseño y el remitente del email;
- la página de nueva contraseña y su política de longitud;
- qué pasa con las sesiones abiertas;
- en muchos productos, SSO en su lugar.

Mientras no esté instalada, un usuario que la olvide depende de que se la restablezcan
desde el panel de Supabase (Authentication → Users). Se reevaluará cuando dos productos
la hayan implementado y se vea qué parte es común.

### Móvil y escritorio: la estrategia cliente/servidor

La auth del core usa Server Actions, route handlers (`/auth/callback`, `/auth/logout`) y
cookies de sesión gestionadas por el servidor. **Nada de eso existe en un bundle
estático** (`output: export`). Antes de empezar `mobile-capacitor` o `desktop-electron`
hay que elegir, y escribir la decisión en el README del módulo:

| Estrategia | Cómo | Consecuencia para el core |
|---|---|---|
| **Ventana sobre la URL remota** | La app nativa carga `https://<dominio>` (Capacitor `server.url`, Electron `loadURL`) | Ninguna: el core funciona tal cual. Requiere conexión y depende de las políticas de las tiendas para apps que solo envuelven una web |
| **Bundle estático** | `output: export` empaquetado dentro de la app | Auth en cliente (supabase-js con almacenamiento local), sin Server Actions ni `proxy.ts` en ese build, y una API remota con CORS. Es un segundo modo de build que hay que mantener |

Recomendación por defecto: **URL remota**, salvo que el producto necesite funcionar sin
conexión. Las dos plataformas comparten esta decisión: si un producto tiene ambas, la
toma una vez.

## Recetas

Lo que es solo una dependencia más un patrón de uso no merece ser módulo. Se documenta
aquí y cada producto lo aplica directamente.

### Gráficas (`charts`)

1. `npm install recharts`.
2. Cárgalo siempre en diferido, porque pesa más de 100 KB:
   `const Grafica = dynamic(() => import("@/components/<modulo>/Grafica"), { ssr: false })`.
3. Colores desde los tokens del tema: `rgb(var(--rgb-primary))`, nunca hexadecimales
   escritos en el componente. Así la gráfica respeta el modo oscuro y la marca.
4. Añade la dependencia a la tabla de `docs/STACK.md` (un test lo exige).

### Analítica de producto (`analytics`)

1. **Antes de nada, el consentimiento**: la analítica de comportamiento requiere un
   banner de cookies (módulo `legal-consent`) y una línea en la política de privacidad.
2. `npm install @vercel/analytics`, y monta `<Analytics />` en `src/app/layout.tsx` **solo
   si hay consentimiento**.
3. Añade la dependencia a la tabla de `docs/STACK.md`.

Speed Insights (Web Vitals, sin cookies) ya está en el core y no es esto.
