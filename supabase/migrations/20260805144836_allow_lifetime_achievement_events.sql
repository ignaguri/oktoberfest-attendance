-- Lifetime achievements unlock once, with no festival. Task 1 made
-- user_achievements.festival_id nullable to represent that, but the
-- achievement_events outbox that insert_achievement_event_from_unlock()
-- writes into still required a festival, so every lifetime unlock failed
-- with a not_null_violation. The event must survive so the user is still
-- notified; only the group-notification path is festival-scoped.
ALTER TABLE public.achievement_events ALTER COLUMN festival_id DROP NOT NULL;

COMMENT ON COLUMN public.achievement_events.festival_id IS
  'NULL for lifetime-scope achievement unlocks, which are not tied to a festival.';
