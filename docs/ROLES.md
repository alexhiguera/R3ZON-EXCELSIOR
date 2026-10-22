# Roles y permisos

## Estado en el core

El core solo distingue dos roles, los de Supabase:

| Rol | Qué puede |
|---|---|
| `anon` (sin sesión) | Ver las rutas públicas. **Ningún** acceso a tablas de `public` (lo vigila el test de catálogo) |
| `authenticated` | Leer su propio perfil y cambiar su `display_name`. Nada más |

`service_role` existe, pero solo lo usan scripts locales y CI: nunca la app.

## El modelo cuando crezca: tres dimensiones desacopladas

Cuando un producto necesite roles, se modelan en **tres dimensiones independientes**, no
en un solo enum:

1. **Nivel de plataforma** — quién es la persona para R3ZON: operador de la plataforma,
   usuario normal, anónimo. Decide el acceso a herramientas internas.
2. **Permisos dentro del tenant** — qué puede hacer un miembro en su organización: matriz
   **recurso × acción** (`recurso:read`, `recurso:write`, `recurso:delete`), con valores
   por defecto por rol del miembro (propietario, miembro) y excepciones por persona.
3. **Plan de suscripción** — cuánto puede usar el tenant (cuotas y límites). **No da ni
   quita permisos**: un plan superior no convierte a un miembro en propietario.

Motivo: meterlas en un solo enum obliga a crear combinaciones que no tienen sentido
(«miembro-premium») y cada comprobación acaba siendo una lista de casos.

## Dónde se aplica cada cosa

- **La barrera real está en Postgres**: policies RLS y triggers que consultan una función
  de permisos (`has_permission(resource, action)` o equivalente). Anclada a la tabla, cubre
  toda vía de escritura, incluidas las RPC ([ARCHITECTURE.md §3](ARCHITECTURE.md)).
- **El cliente solo refleja**: ocultar un botón o mostrar un aviso es experiencia de
  usuario, no seguridad.
- Los límites de plan se aplican también por trigger, con un test que intenta superarlos
  saltándose la interfaz.

## Modelo previsto en Excelsior

> **Dimensiones 1 y 2 implementadas en la base** (Fase 1): `profiles.platform_role`,
> `organization_members.role` y sus policies, probadas en `tests/db/organizations.test.ts`.
> Hoy el staff gestiona organizaciones, miembros e invitaciones; la matriz por recurso de
> abajo se irá aplicando con cada tabla de las fases siguientes.

### Dimensión 1 — Nivel de plataforma

| Nivel | Quién | Qué ve |
|---|---|---|
| `admin` | Staff de R3ZON con gestión total | Todo, incluidos precios internos, catálogo, plantillas de contrato y usuarios del staff |
| `staff` | Resto del equipo de R3ZON | Todos los clientes, proyectos, contratos, pagos y tickets; no gestiona staff ni catálogo |
| `client` | Usuario de una empresa cliente | Solo sus organizaciones |

La división `admin` / `staff` está decidida (T-12 de [PLAN.md](PLAN.md)). El nivel **no lo puede cambiar el propio usuario**: columna sin
grant de `UPDATE` para `authenticated` y cambios registrados en el audit log.

### Dimensión 2 — Rol dentro de la empresa cliente

| Rol | Pensado para | Puede |
|---|---|---|
| `owner` | Gerente / firmante | Todo lo de su empresa: firmar contratos, aceptar propuestas, pagar, gestionar usuarios de su empresa |
| `member` | Marketing, técnico | Ver servicios y proyectos, aportar briefing y documentos, abrir tickets |
| `billing` | Administración | Ver contratos y facturas, pagar, editar datos fiscales |

El primer usuario de un cliente (el que acepta la invitación inicial) es `owner`. Un
usuario puede pertenecer a varias empresas, con selector de empresa (T-13).

Matriz inicial de **recurso × acción** (se completa al implementar cada fase):

| Recurso | `owner` | `member` | `billing` | staff |
|---|---|---|---|---|
| Datos fiscales de la empresa | leer, editar | leer | leer, editar | todo |
| Usuarios de la empresa | invitar, cambiar rol, quitar | leer | leer | todo |
| Contratos | leer, **firmar** | leer | leer | crear, enviar, leer |
| Propuestas | leer, **aceptar** / rechazar | leer | leer | crear, enviar |
| Pagos y facturas | leer, pagar | — | leer, pagar | leer, marcar entrega |
| Briefing y documentos | todo | todo | leer | todo |
| Tickets | abrir, responder | abrir, responder | abrir, responder | todo + notas internas |

### Dimensión 3 — Plan

Los planes de mantenimiento u otros servicios recurrentes (Fase 6) dan **límites y
niveles de servicio** (p. ej. SLA de tickets, horas incluidas), **nunca permisos**.

## Módulos

- `multi-tenancy` — organizaciones y pertenencia (base para la dimensión 2).
- `roles-permissions` — la matriz de permisos y sus triggers.
- `billing-stripe` — planes, límites y asientos (dimensión 3).

Ver [`modules/README.md`](../modules/README.md). Al instalar cualquiera de ellos, este
documento se actualiza con la matriz real del producto.
