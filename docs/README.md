# Documentación interna

Documentación para quien desarrolla y mantiene el proyecto. La documentación para los
usuarios del producto está en [`public_docs/`](../public_docs/README.md).

## Índice

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
- [RESTAURACION.md](RESTAURACION.md) — backups y restauración.

### Seguimiento
- [CHANGELOG.md](CHANGELOG.md) — bitácora de iteraciones, con el porqué.
- [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) — solo tareas abiertas, priorizadas.
- [mejoras.md](mejoras.md) — propuestas con lo que las desbloquea.

### Solo en el repositorio de la plantilla
- `auditoria-template-final.md` — auditoría y cierre de la v1.0 de la plantilla. Un
  proyecto derivado lo borra ([TEMPLATE.md](TEMPLATE.md)); por eso nada lo enlaza.

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
2. Después [ARCHITECTURE.md](ARCHITECTURE.md) y [STRUCTURE.md](STRUCTURE.md) para
   orientarte.
3. Antes de tocar la base: [DATABASE.md](DATABASE.md). Antes de tocar rutas o sesión:
   [AUTH.md](AUTH.md). Antes de tocar `public_docs/`: su
   [README](../public_docs/README.md).
4. El estado real del proyecto está en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)
   («Estado hoy») y en las últimas entradas de [CHANGELOG.md](CHANGELOG.md).
