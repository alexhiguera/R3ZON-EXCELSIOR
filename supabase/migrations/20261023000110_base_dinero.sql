-- =============================================================================
-- Excelsior · módulo BASE — dinero: céntimos enteros y una sola política de
-- redondeo
-- =============================================================================
--
-- Representación (como Stripe para EUR): todo importe es un `bigint` en
-- CÉNTIMOS. 1 € = 100; 10,50 € = 1050; 1.500,00 € = 150000. Sumar y restar
-- céntimos es exacto: nunca redondea.
--
-- Solo hay redondeo cuando se aplica un PORCENTAJE (IVA, descuento) o se
-- REPARTE un importe (hitos), porque el resultado puede caer entre dos
-- céntimos (21 % de 1050 = 220,5). Esa política vive aquí y en ningún otro
-- sitio (docs/ARCHITECTURE.md §18):
--
--   · money_percent: porcentaje en `numeric` (decimal exacto, sin coma
--     flotante) y un ÚNICO redondeo al céntimo, medio céntimo hacia arriba
--     (`round` de numeric: mitad lejos de cero; los importes son >= 0).
--   · El IVA se calcula UNA vez por tipo, sobre la suma de las bases de ese
--     tipo (como el desglose de una factura TicketBAI), no línea a línea.
--   · money_split: reparto proporcional por pesos con céntimos enteros; los
--     céntimos que sobran van, de uno en uno, a los ÚLTIMOS hitos. Determinista
--     y exacto: la suma es siempre el total (1.000 € en 3 → 333,33 + 333,33 +
--     333,34).
--
-- Los tipos impositivos y porcentajes son `numeric(5,2)` (21,00; 10,00; 4,00).
--
-- Depende de: nada.
-- =============================================================================

-- 150000 → «1.500,00 €» (separador de miles siempre, como la interfaz).
create function public.format_eur(p_cents bigint)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when p_cents < 0 then '-' else '' end
      || regexp_replace((abs(p_cents) / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
      || ',' || lpad((abs(p_cents) % 100)::text, 2, '0') || ' €';
$$;

-- Porcentaje de un importe en céntimos, redondeado una vez (medio céntimo
-- hacia arriba). money_percent(1050, 21) = 221 (220,5 → 221).
create function public.money_percent(p_cents bigint, p_rate numeric)
returns bigint
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select round(p_cents::numeric * p_rate / 100)::bigint;
$$;

-- Reparte `p_total` céntimos en proporción a `p_weights` (enteros > 0). Cada
-- parte es el cociente entero; los céntimos que faltan se suman de uno en uno
-- a las últimas partes. La suma es exactamente `p_total`.
create function public.money_split(p_total bigint, p_weights integer[])
returns bigint[]
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_n integer := coalesce(cardinality(p_weights), 0);
  v_sum bigint := 0;
  v_parts bigint[] := '{}';
  v_resto bigint;
  i integer;
begin
  if v_n = 0 then
    return v_parts;
  end if;
  if p_total < 0 then
    raise exception 'No se reparte un importe negativo' using errcode = 'P0001';
  end if;
  for i in 1 .. v_n loop
    if p_weights[i] is null or p_weights[i] <= 0 then
      raise exception 'Los pesos de un reparto son enteros positivos' using errcode = 'P0001';
    end if;
    v_sum := v_sum + p_weights[i];
  end loop;
  for i in 1 .. v_n loop
    -- División entera de enteros: exacta, sin decimales.
    v_parts := v_parts || ((p_total * p_weights[i]) / v_sum);
  end loop;
  v_resto := p_total - (select sum(x) from unnest(v_parts) x);
  i := v_n;
  while v_resto > 0 loop
    v_parts[i] := v_parts[i] + 1;
    v_resto := v_resto - 1;
    i := case when i = 1 then v_n else i - 1 end;
  end loop;
  return v_parts;
end;
$$;

comment on function public.money_percent(bigint, numeric) is
  'Porcentaje de un importe en céntimos con UN redondeo al céntimo (medio hacia arriba). Única política de redondeo de porcentajes.';
comment on function public.money_split(bigint, integer[]) is
  'Reparto exacto de céntimos por pesos; el resto, de uno en uno a las últimas partes. La suma es el total.';

revoke execute on function public.format_eur(bigint), public.money_percent(bigint, numeric),
  public.money_split(bigint, integer[]) from public, anon;
grant execute on function public.format_eur(bigint), public.money_percent(bigint, numeric),
  public.money_split(bigint, integer[]) to authenticated;
