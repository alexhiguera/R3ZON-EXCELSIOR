# Documentación interna — Excelsior

Documentación para quien desarrolla y mantiene **Excelsior**, el área de clientes de
R3ZON (`clientes.r3zon.com`). La documentación para los usuarios del producto está en
[`public_docs/`](../public_docs/README.md).

## Índice

### Producto
- [PRODUCTO.md](PRODUCTO.md) — qué es Excelsior, para quién, el flujo de invitación →
  contrato → pago → briefing, glosario y fuera de alcance.
- [PLAN.md](PLAN.md) — plan de desarrollo por fases, hito MVP, decisiones tomadas y
  abiertas, riesgos.

### Empezar
- [TEMPLATE.md](TEMPLATE.md) — versión de la plantilla, crear un proyecto, qué hacer con
  cada documento y cómo incorporar versiones nuevas del core.
- [DEVELOPMENT.md](DEVELOPMENT.md) — levantar el proyecto en local, scripts, tests,
  variables de entorno, ramas.
- [DEPLOYMENT.md](DEPLOYMENT.md) — puesta en producción y qué hacer cuando algo falla.

### Arquitectura
- [ARCHITECTURE.md](ARCHITECTURE.md) — principios y el porqué de cada uno.
- [STACK.md](STACK.md) — tecnologías, versiones, dependencias y observabilidad.
- [STRUCTURE.md](STRUCTURE.md) — árbol del repositorio y qué va en cada sitio.
- [DATABASE.md](DATABASE.md) — migraciones, Prisma, RLS, drift y tests de BD.
- [MODULES.md](MODULES.md) — qué hay en el core y qué módulos tiene instalados el proyecto.

### Seguridad
- [AUTH.md](AUTH.md) — sesión, login, callback, logout y rutas públicas.
- [ROLES.md](ROLES.md) — modelo de roles y permisos, y cómo crece.
- [auditoria.md](auditoria.md) — revisiones de seguridad y estado de cada hallazgo.
- [RGPD.md](RGPD.md) — datos personales, bases legales, conservación (6 años), derechos,
  exportación e importación.
- [RESTAURACION.md](RESTAURACION.md) — backups y restauración.

### Seguimiento
- [CHANGELOG.md](CHANGELOG.md) — bitácora de iteraciones, con el porqué.
- [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) — solo tareas abiertas, priorizadas.
- [mejoras.md](mejoras.md) — propuestas e ideas de producto, con lo que las desbloquea.

## Cómo contribuir a estos documentos

- Si un cambio de código afecta a lo que describe un documento, se actualiza **en la
  misma tarea**. Un documento que describe un estado que ya no existe es peor que no
  tenerlo.
- Se escribe el **porqué**, no solo el qué: el qué está en el código.
- Enlaces relativos entre documentos y hacia el código. `npm run docs:enlaces` comprueba
  que ninguno esté roto (menos en `CHANGELOG.md`, que es histórico).
- Convenciones de la bitácora y de las tareas: [`CLAUDE.md`](../CLAUDE.md) §7.

## Para LLMs / agentes

1. Lee [`CLAUDE.md`](../CLAUDE.md) entero: son las reglas de trabajo.
2. Después [PRODUCTO.md](PRODUCTO.md) (el qué) y [PLAN.md](PLAN.md) (en qué fase
   estamos y qué está decidido).
3. Después [ARCHITECTURE.md](ARCHITECTURE.md) y [STRUCTURE.md](STRUCTURE.md) para
   orientarte. Lo marcado como **previsto** describe el plan, no el código: compruébalo
   antes de darlo por hecho.
4. Antes de tocar la base: [DATABASE.md](DATABASE.md). Antes de tocar rutas o sesión:
   [AUTH.md](AUTH.md). Antes de tocar `public_docs/`: su
   [README](../public_docs/README.md).
5. El estado real del proyecto está en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)
   («Estado hoy») y en las últimas entradas de [CHANGELOG.md](CHANGELOG.md).
