-- Adding tents to a festival, with their beer price, in one transaction.
--
-- The admin repository inserted festival_tents rows and then wrote the
-- canonical drink_type_prices rows as separate requests, so a failure between
-- them left tents priced only by the columns. Same three places as
-- set_festival_tent_beer_price (20261001150030); this is its batch insert
-- counterpart.
--
-- Tents the festival already serves are skipped, not repriced. Returns the rows
-- actually inserted. SECURITY INVOKER: RLS's "super admins can manage" policies
-- are the gate.
create or replace function public.add_festival_tents(p_festival_id uuid, p_tents jsonb)
returns table (festival_tent_id uuid, tent_id uuid)
language sql
security invoker
set search_path = public
as $$
  with inserted as (
    insert into public.festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
    select p_festival_id, t.tent_id, t.beer_price, round(t.beer_price * 100)::integer
    from jsonb_to_recordset(p_tents) as t (tent_id uuid, beer_price numeric)
    on conflict (festival_id, tent_id) do nothing
    returning id, festival_tents.tent_id, beer_price_cents
  ),
  -- New festival_tents ids, so there is no existing row to conflict with
  priced as (
    insert into public.drink_type_prices (festival_tent_id, drink_type, price_cents)
    select id, 'beer', beer_price_cents
    from inserted
    where beer_price_cents is not null
  )
  select id, inserted.tent_id from inserted;
$$;

-- Supabase grants new functions to anon directly, so PUBLIC alone is not enough.
revoke execute on function public.add_festival_tents(uuid, jsonb) from public, anon;
grant execute on function public.add_festival_tents(uuid, jsonb) to authenticated;

-- Lets super admins correct a day's logged drinks. They could already read
-- every consumption; adding, retyping and removing them is the admin editor
-- for a day whose count comes from consumptions rather than beer_count.
CREATE POLICY "Super admins can manage consumptions"
  ON public.consumptions
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
