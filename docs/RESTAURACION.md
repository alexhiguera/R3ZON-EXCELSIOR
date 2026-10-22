# Backups y restauración

## Estado en el core: no hay backups propios

La plantilla **no incluye ningún sistema de backup**. Depende de lo que ofrezca el plan
de Supabase Cloud del proyecto:

| Plan de Supabase | Backups nativos | Qué hacer |
|---|---|---|
| Free | **Ninguno**, sin PITR | Instalar el módulo `backups` **antes de tener datos reales** |
| Pro o superior | Diarios; PITR opcional | Valorar igualmente el módulo: los backups nativos no cubren Storage, y restaurar no se ha probado hasta que se ensaya |

Decidirlo es una tarea del proyecto antes de salir a producción
([TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) la lleva ya).

### En Excelsior

Excelsior guardará **contratos firmados** (evidencia legal) y el **material de los
clientes** en Storage, además de datos de facturación en la base. Perder cualquiera de
ellos no es recuperable pidiéndoselo otra vez al cliente. Por eso:

- Plan de Supabase con backups (Pro) **antes del hito MVP** (decisión D-07 de
  [PLAN.md](PLAN.md)), y aun así el módulo `backups` para **Storage**.
- Simulacro de restauración hecho y anotado en la bitácora antes del primer cliente real.

## Qué debe cubrir un backup

1. **Esquema y datos**, incluido `auth.users` (sin él, los perfiles quedan huérfanos).
2. **Roles y grants**: sin ellos, una restauración «funciona» pero con permisos distintos.
3. **Storage** (si se usa): ningún volcado SQL contiene los ficheros, solo sus metadatos.
4. **Secretos que viven en la base** (claves de Vault): sin la clave, los datos cifrados
   de un backup no sirven.

## Restauración manual (sin módulo)

Para un proyecto con backups nativos, o para restaurar un volcado en local:

```bash
# Volcado del esquema y los datos de un proyecto (requiere la URL de conexión)
npx supabase db dump --db-url "$DB_URL" -f schema.sql
npx supabase db dump --db-url "$DB_URL" --data-only -f data.sql

# Restaurar en el stack LOCAL, nunca directamente en producción
npm run db:reset
psql "postgresql://postgres:postgres@127.0.0.1:55422/postgres" -f data.sql
```

Regla: **se ensaya siempre primero en local**. Una restauración en producción es una
operación que requiere autorización expresa.

## Simulacros

Un backup no está probado hasta que se ha restaurado. El módulo `backups` incluye un
simulacro mensual automático (restaurar el último snapshot en un Supabase limpio y
comparar el número de filas tabla por tabla).

**Origen.** En el proyecto de origen se generaron backups a diario durante tres meses sin
comprobar nunca que sirvieran para restaurar. Cuando se comprobó, el volcado enumeraba a
mano 18 tablas de las 54 que había, y seis tablas con datos de facturación llevaban meses
sin respaldarse.
