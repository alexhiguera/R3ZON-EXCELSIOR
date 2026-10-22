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

## Módulos

- `multi-tenancy` — organizaciones y pertenencia (base para la dimensión 2).
- `roles-permissions` — la matriz de permisos y sus triggers.
- `billing-stripe` — planes, límites y asientos (dimensión 3).

Ver [`modules/README.md`](../modules/README.md). Al instalar cualquiera de ellos, este
documento se actualiza con la matriz real del producto.
