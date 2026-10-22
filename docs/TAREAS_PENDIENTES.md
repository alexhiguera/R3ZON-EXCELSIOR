# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

> Estas son las tareas **de la plantilla**. Un proyecto derivado vacía este fichero y
> empieza con las de «Al crear un proyecto» ([TEMPLATE.md](TEMPLATE.md)).

## Estado hoy — *2026-09-26*

| Comprobación | Resultado |
|---|---|
| `npm run lint` · `typecheck` | ✅ |
| `npm run test` (con `CI=true`) | ✅ 96 tests en 12 ficheros (78 sin BD + 18 contra Postgres) |
| `npm run test:e2e` | ✅ 8 tests |
| `npm run build` | ✅ también sin `.env.local` |
| `npm run db:drift` · `db:types:check` | ✅ |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades (2 overrides vigentes) |
| Proyecto derivado simulado (personalizado según `TEMPLATE.md`) | ✅ todo en verde; las comprobaciones de identidad y derivación saltan cuando deben |
| Migraciones | 1 (`core_profiles`), solo en local |
| Versión | `r3zon-template.json` 1.0.0, **sin etiquetar** |

## Plantilla

- [ ] 🔴 **Primera ejecución de los workflows en GitHub, y después el tag `v1.0.0`.**
  `ci.yml`, `e2e.yml` y `security.yml` se han reproducido paso a paso en local, pero no
  han corrido nunca en un runner. Al verlos en verde:
  - comprobar si `actions/checkout`, `setup-node` y `upload-artifact` tienen una versión
    mayor más nueva que `v4` y si GitHub avisa de retirada de su runtime;
  - etiquetar `v1.0.0`;
  - quitar «pendiente de etiquetar» en `TEMPLATE.md` → Versiones.

## Al crear un proyecto desde la plantilla

Estas no se cierran en la plantilla: pasan al `TAREAS_PENDIENTES.md` del proyecto nuevo.

- [ ] 🔴 Personalizar identidad, puertos, `_meta/` y documentos
  ([TEMPLATE.md](TEMPLATE.md) → Crear un proyecto). `docs:validar` y los tests fallan
  mientras falte algo.
- [ ] 🔴 Rellenar los invariantes de `CLAUDE.md` §0.
- [ ] 🔴 Decidir backups según el plan de Supabase antes de tener datos reales
  ([RESTAURACION.md](RESTAURACION.md)).
- [ ] 🟠 Decidir si Speed Insights va detrás de consentimiento según la política de
  privacidad del producto ([STACK.md](STACK.md)).
- [ ] 🟠 Definir la CSP con la lista de terceros del producto ([mejoras.md](mejoras.md)).
- [ ] 🟠 Si se publica la documentación, dar de alta el producto en
  `R3ZON-Docusaurus/config/products.ts`.
