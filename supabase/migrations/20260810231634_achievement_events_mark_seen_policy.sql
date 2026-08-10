-- Let users acknowledge their own achievement unlocks.
--
-- achievement_events had RLS enabled with a SELECT policy and nothing else, so
-- POST /achievements/seen -> AchievementMetricsRepository.markUnlocksSeen ran its
-- UPDATE through the request-scoped user client and silently matched zero rows.
-- Postgres does not error on an RLS-filtered UPDATE, so the endpoint answered
-- 200 {"acknowledged":0} and user_notified_at was never stamped. The pending
-- outbox therefore never drained and every unlock re-toasted on every load.
--
-- Two changes, because the policy alone is not enough. Supabase grants the
-- authenticated role table-wide UPDATE by default, so a bare UPDATE policy would
-- also let a user rewrite achievement_id, created_at or rarity on their own
-- rows. Narrowing the grant to a single column keeps the writable surface to
-- exactly the acknowledgement flag.
--
-- markUnlocksSeen is the only writer to this table that uses a user-scoped
-- client. The backfill script (scripts/backfill-achievements.ts), which is the
-- only writer of group_notified_at, connects with the service role and so
-- bypasses both RLS and these grants.

REVOKE UPDATE ON public.achievement_events FROM authenticated, anon;

GRANT UPDATE (user_notified_at) ON public.achievement_events TO authenticated;

-- WITH CHECK forbids clearing the stamp back to NULL: acknowledgement only ever
-- moves forward, so a client cannot replay its own unlock toasts. markUnlocksSeen
-- always writes now(), so it satisfies this.
CREATE POLICY "Users can acknowledge their own achievement_events"
  ON public.achievement_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND user_notified_at IS NOT NULL);
