-- Two admin writes that were several PostgREST calls with no transaction
-- around them, so a failure halfway left the data in a state nobody asked for.
--
-- Both are SECURITY INVOKER on purpose: festivals, festival_tents and
-- drink_type_prices each have a "super admins can manage" policy, so RLS is
-- already the gate the repository relied on. A non-admin caller updates no rows.

-- 1. Activating a festival.
--
-- idx_festivals_single_active is a unique partial index, so the others have to
-- be cleared before this one is set. Done as two requests, a failure between
-- them left no active festival at all, and findActive() has no fallback.
create or replace function public.set_active_festival(p_festival_id uuid)
returns public.festivals
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.festivals;
begin
  update public.festivals
  set is_active = false
  where is_active = true
    and id <> p_festival_id;

  update public.festivals
  set is_active = true
  where id = p_festival_id
  returning * into result;

  if not found then
    raise exception 'festival % not found', p_festival_id using errcode = 'P0002';
  end if;

  return result;
end;
$$;

-- 2. Setting a tent's beer price.
--
-- One number lives in three places: festival_tents.beer_price (euros),
-- beer_price_cents, and the canonical drink_type_prices row. Written as
-- separate requests, a failure on the last one answered 500 while the two
-- columns already held the new price. Returns the festival_tents id, or null
-- when the tent is not assigned to the festival.
--
-- drink_type_prices_tent_unique is a partial index, which PostgREST cannot
-- target with on_conflict; plpgsql can, by repeating its predicate.
create or replace function public.set_festival_tent_beer_price(
  p_festival_id uuid,
  p_tent_id uuid,
  p_beer_price numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_festival_tent_id uuid;
  -- Same rounding as toCents() in admin.repository.ts
  v_price_cents integer := round(p_beer_price * 100)::integer;
begin
  update public.festival_tents
  set beer_price = p_beer_price,
      beer_price_cents = v_price_cents
  where festival_id = p_festival_id
    and tent_id = p_tent_id
  returning id into v_festival_tent_id;

  if v_festival_tent_id is null then
    return null;
  end if;

  if v_price_cents is null then
    -- drink_type_prices_positive_price rejects <= 0, so no price is no row
    delete from public.drink_type_prices
    where festival_tent_id = v_festival_tent_id
      and drink_type = 'beer';
  else
    insert into public.drink_type_prices (festival_tent_id, drink_type, price_cents)
    values (v_festival_tent_id, 'beer', v_price_cents)
    on conflict (festival_tent_id, drink_type) where festival_tent_id is not null
    do update set price_cents = excluded.price_cents,
                  updated_at = now();
  end if;

  return v_festival_tent_id;
end;
$$;

-- Only signed-in users can reach these; RLS then decides what they change.
-- Supabase grants new functions to anon directly, so PUBLIC alone is not enough.
revoke execute on function public.set_active_festival(uuid) from public, anon;
revoke execute on function public.set_festival_tent_beer_price(uuid, uuid, numeric) from public, anon;
grant execute on function public.set_active_festival(uuid) to authenticated;
grant execute on function public.set_festival_tent_beer_price(uuid, uuid, numeric) to authenticated;
