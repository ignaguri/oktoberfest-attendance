-- user_achievements.user_id had no FK, so deleting an account left its
-- achievements behind. Clear existing orphans, then cascade from auth.users.
DELETE FROM public.user_achievements ua
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ua.user_id);

ALTER TABLE public.user_achievements
  ADD CONSTRAINT user_achievements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- Same gap on standings; past festivals are never recomputed, so rows stayed.
DELETE FROM public.festival_group_standings s
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

ALTER TABLE public.festival_group_standings
  ADD CONSTRAINT festival_group_standings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
