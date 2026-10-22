-- =============================================================================
-- Excelsior — UUIDv7 para las claves primarias
-- =============================================================================
--
-- Decisión de R3ZON (2026-10-22): las claves primarias nuevas son UUIDv7
-- (RFC 9562): 48 bits de milisegundos Unix seguidos de bits aleatorios.
--
-- Por qué: ordenan por fecha de creación, así que los índices B-tree insertan
-- al final en vez de en sitios aleatorios (menos páginas tocadas, menos
-- fragmentación), y `order by id` equivale a orden de alta.
--
-- Contrapartida: el id revela CUÁNDO se creó la fila (no quién ni qué). Por eso
-- nunca se usa un UUID como secreto: los tokens (invitaciones…) son bytes
-- aleatorios aparte, guardados como hash.
--
-- Postgres 17 no trae `uuidv7()` (llega en Postgres 18) y Supabase no ofrece
-- extensión. Esta función usa el MISMO nombre que la nativa: el día que el
-- proyecto pase a Postgres 18, la de `pg_catalog` estará disponible y una
-- migración podrá cambiar los defaults y borrar esta.
--
-- Fuera de alcance: `auth.users.id` (y por tanto `profiles.id`) lo genera
-- Supabase Auth como UUIDv4. No se toca.
--
-- REGLA: esta migración, una vez aplicada en cualquier entorno, no se edita.
-- =============================================================================

create function public.uuidv7()
returns uuid
language sql
volatile
parallel safe
security invoker
set search_path = ''
as $$
  -- Parte de un UUIDv4 (122 bits aleatorios, variante RFC ya puesta):
  --   1. sobrescribe los 6 primeros bytes con los milisegundos Unix (48 bits);
  --   2. cambia la versión de 4 (0100) a 7 (0111) encendiendo los bits 52 y 53.
  -- clock_timestamp() y no now(): now() es la hora de inicio de la transacción
  -- y todas las filas de una misma transacción compartirían milisegundo.
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

comment on function public.uuidv7() is
  'UUIDv7 (RFC 9562): default de toda clave primaria nueva. Sustituible por la nativa de Postgres 18.';

-- Un DEFAULT se evalúa con los privilegios de quien inserta: quien pueda
-- insertar filas necesita poder ejecutarla. No da acceso a nada.
grant execute on function public.uuidv7() to authenticated, service_role;
