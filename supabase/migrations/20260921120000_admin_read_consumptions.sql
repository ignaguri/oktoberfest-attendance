-- Let super admins read consumptions.
--
-- The admin panel lists a user's days through `attendance_with_totals`, which
-- is a `security_invoker` view: its LATERAL count over `consumptions` runs
-- under the caller's own policies. `attendances` already carries a "Super
-- admins can do anything" policy, but `consumptions` only has owner,
-- friend and group-member SELECT policies. So an admin reading a stranger's
-- days gets no consumption rows and the view falls back to
-- `attendances.beer_count` -- the column the RPCs stopped writing in
-- 20260317130000_stop_writing_beer_count, and which is therefore 0 on every
-- day created since.
--
-- SELECT only, not "do anything": the panel reads these rows, it never writes
-- them. Editing somebody's drinks is not something the admin UI offers, and a
-- policy added to fix a read should not quietly open the write.

create policy "Super admins can view all consumptions"
  on "public"."consumptions"
  for select
  using ("public"."is_super_admin"());
