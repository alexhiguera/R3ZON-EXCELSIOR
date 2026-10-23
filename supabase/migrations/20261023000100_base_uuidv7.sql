-- =============================================================================
-- Excelsior · módulo BASE — UUIDv7 para las claves primarias
-- =============================================================================
--
-- Decisión de R3ZON (T-16): toda clave primaria nueva es UUIDv7 (RFC 9562):
-- 48 bits de milisegundos Unix seguidos de bits aleatorios.
--
-- Por qué: ordenan por fecha de creación, así que los índices B-tree insertan
-- al final en vez de en sitios aleatorios (menos páginas tocadas, menos
-- fragmentación), y `order by id` equivale a orden de alta.
--
-- Contrapartida: el id revela CUÁNDO se creó la fila (no quién ni qué). Por eso
-- nunca se usa un UUID como secreto: los tokens son bytes aleatorios aparte,
-- guardados como hash.
--
-- Postgres 18 la trae de serie, pero Supabase aún no ofrece Postgres 18
-- (comprobado el 2026-10-23: la CLI 2.121 rechaza `major_version = 18`). Esta
-- implementación es correcta y DEFINITIVA, no un parche: produce UUIDv7 válidos
-- y no habrá que migrar nada cuando llegue Postgres 18. Tiene el mismo nombre
-- que la nativa para que se lea igual.
--
-- Fuera de alcance: `auth.users.id` (y por tanto `profiles.id`) lo genera
-- Supabase Auth como UUIDv4.
-- =============================================================================

create function public.uuidv7()
returns uuid
language sql
volatile
parallel safe
security invoker
set search_path = ''
as $$
  -- RFC 9562, método 3 (el mismo que usa el uuidv7() nativo de Postgres 18):
  --   · bytes 1-6  (48 bits): milisegundos Unix;
  --   · bytes 7-8  (16 bits): versión 7 (0111) + 12 bits de FRACCIÓN de
  --     milisegundo, para que dos ids del mismo milisegundo salgan en orden;
  --   · bytes 9-16 (64 bits): los de un UUIDv4 (aleatorios, variante RFC ya puesta).
  -- clock_timestamp() y no now(): now() es la hora de inicio de la transacción
  -- y todas las filas de una transacción compartirían instante.
  with t as (
    select floor(extract(epoch from clock_timestamp()) * 1000000)::bigint as us
  )
  select encode(
    overlay(
      overlay(
        uuid_send(gen_random_uuid())
        placing substring(int8send(t.us / 1000) from 3)
        from 1 for 6
      )
      placing substring(int4send(28672 | (((t.us % 1000) * 4096) / 1000)::int) from 3)
      from 7 for 2
    ),
    'hex'
  )::uuid
  from t;
$$;

comment on function public.uuidv7() is
  'UUIDv7 (RFC 9562): default de toda clave primaria. Implementación definitiva mientras Supabase no ofrezca Postgres 18.';

-- Un DEFAULT se evalúa con los privilegios de quien inserta: quien pueda
-- insertar filas necesita poder ejecutarla. No da acceso a nada.
grant execute on function public.uuidv7() to authenticated, service_role;
