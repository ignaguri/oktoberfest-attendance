-- Run after evaluating achievements: spread unlock times and silence unlock popups.
BEGIN;
UPDATE user_achievements ua SET unlocked_at = timestamptz '2025-10-05 19:00+02' - (random() * interval '10 days')
FROM festivals f WHERE f.id = ua.festival_id AND f.short_name = 'oktoberfest-2025'
  AND ua.user_id::text LIKE 'de000000-%';
UPDATE user_achievements ua SET unlocked_at = CASE WHEN ua.festival_id IS NULL THEN timestamptz '2025-09-21 18:00+02' ELSE timestamptz '2026-09-19 14:00+02' + (random() * interval '3 days') END
WHERE ua.user_id::text LIKE 'de000000-%' AND (ua.festival_id IS NULL OR ua.festival_id = (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026'));
-- A few fresh ones for the feed.
UPDATE user_achievements ua SET unlocked_at = now() - r.ago
FROM (VALUES ('de000000-0000-4000-a000-000000000002'::uuid, 'drinks_day_max.t2', interval '1 hour 50 minutes'),
             ('de000000-0000-4000-a000-000000000004'::uuid, 'drink_variety.t2', interval '2 hours 40 minutes'),
             ('de000000-0000-4000-a000-000000000006'::uuid, 'attendance_streak.t1', interval '48 minutes'),
             ('de000000-0000-4000-a000-000000000003'::uuid, 'days_attended.t2', interval '3 hours 5 minutes')) r(uid, slug, ago),
     achievements a
WHERE ua.user_id = r.uid AND a.id = ua.achievement_id AND a.slug = r.slug
  AND ua.festival_id = (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026');
UPDATE achievement_events SET user_notified_at = now(), group_notified_at = now(),
  created_at = (SELECT ua.unlocked_at FROM user_achievements ua WHERE ua.user_id = achievement_events.user_id AND ua.achievement_id = achievement_events.achievement_id AND ua.festival_id IS NOT DISTINCT FROM achievement_events.festival_id)
WHERE user_id::text LIKE 'de000000-%';
COMMIT;
