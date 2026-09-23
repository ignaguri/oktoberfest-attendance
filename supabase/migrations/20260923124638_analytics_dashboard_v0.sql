-- Analytics dashboard v0: the analytics schema, the real-user filter, and the
-- admin metric functions that need only domain tables (no events exist yet).
--
-- Access model: apart from public.wrapped_views (users record and read their
-- own rows, under RLS), nothing here is reachable by anon or authenticated.
-- The metric functions are SECURITY DEFINER, executable by service_role only, and called
-- by the API's /v1/admin/analytics/* routes (behind requireAdmin) through the
-- service-role client. They live in public only because PostgREST exposes
-- public and not analytics.
--
-- Supabase default privileges grant new functions to anon and authenticated
-- directly, so REVOKE ... FROM PUBLIC alone is not enough: both roles are
-- revoked by name.
--
-- Dates are UTC: timestamptz::date uses the session time zone, UTC on Supabase.

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA analytics TO service_role;
COMMENT ON SCHEMA analytics IS
  'Product analytics for the admin dashboard and ad-hoc SQL. Start from analytics.real_users: every metric excludes unconfirmed (bot) signups, super admins and @example.com seed accounts.';

-- ---------------------------------------------------------------------------
-- wrapped_views
-- ---------------------------------------------------------------------------
-- wrapped_data_cache.first_viewed_at can't record views: triggers on
-- attendances, tent_visits and user_achievements delete the cache row, and the
-- wrapped_viewed unlock a first view triggers is one of them. This table is
-- written once per user and festival and nothing invalidates it.
CREATE TABLE IF NOT EXISTS public.wrapped_views (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals (id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, festival_id)
);

ALTER TABLE public.wrapped_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wrapped_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.wrapped_views TO authenticated;
GRANT ALL ON public.wrapped_views TO service_role;

CREATE POLICY "Users can view own wrapped views" ON public.wrapped_views
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can record own wrapped views" ON public.wrapped_views
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.wrapped_views IS
  'First time each user saw their Wrapped for a festival. Insert-only from GET /wrapped/{festivalId}; source for the wrapped row in analytics_feature_usage.';

-- ---------------------------------------------------------------------------
-- real_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.real_users AS
SELECT
  u.id AS user_id,
  u.created_at AS signed_up_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email_confirmed_at IS NOT NULL
  AND COALESCE(p.is_super_admin, false) = false
  AND u.email NOT ILIKE '%@example.com';

REVOKE ALL ON analytics.real_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON analytics.real_users TO service_role;

COMMENT ON VIEW analytics.real_users IS
  'People, not bots: email-confirmed auth users, excluding super admins and @example.com seed accounts. About 60% of auth.users are an email-abuse campaign that never confirms, so join through this view for any user count.';
COMMENT ON COLUMN analytics.real_users.user_id IS 'auth.users.id (= profiles.id).';
COMMENT ON COLUMN analytics.real_users.signed_up_at IS 'auth.users.created_at: when the account was created.';

-- ---------------------------------------------------------------------------
-- festival_retention
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.festival_retention AS
WITH attendees AS (
  SELECT DISTINCT a.festival_id, a.user_id
  FROM public.attendances a
  JOIN analytics.real_users ru ON ru.user_id = a.user_id
),
ordered AS (
  SELECT
    f.id,
    f.name,
    f.start_date,
    lead(f.id) OVER w AS next_festival_id,
    lead(f.start_date) OVER w AS next_start_date
  FROM public.festivals f
  WINDOW w AS (ORDER BY f.start_date, f.id)
),
flags AS (
  SELECT
    o.id AS festival_id,
    att.user_id,
    EXISTS (
      SELECT 1 FROM attendees nxt
      WHERE nxt.festival_id = o.next_festival_id AND nxt.user_id = att.user_id
    ) AS came_next,
    EXISTS (
      SELECT 1
      FROM attendees later
      JOIN public.festivals lf ON lf.id = later.festival_id
      WHERE later.user_id = att.user_id
        AND (lf.start_date, lf.id) > (o.start_date, o.id)
    ) AS came_later
  FROM ordered o
  JOIN attendees att ON att.festival_id = o.id
)
SELECT
  o.id AS festival_id,
  o.name AS festival_name,
  o.start_date,
  count(fl.user_id)::integer AS attendees,
  CASE
    WHEN o.next_start_date IS NULL OR o.next_start_date > current_date THEN NULL
    ELSE (count(*) FILTER (WHERE fl.came_next))::integer
  END AS returned_next,
  (count(*) FILTER (WHERE fl.came_later))::integer AS returned_any
FROM ordered o
LEFT JOIN flags fl ON fl.festival_id = o.id
GROUP BY o.id, o.name, o.start_date, o.next_start_date;

REVOKE ALL ON analytics.festival_retention FROM PUBLIC, anon, authenticated;
GRANT SELECT ON analytics.festival_retention TO service_role;

COMMENT ON VIEW analytics.festival_retention IS
  'One row per festival: how many real users attended, and how many of them came back. Groups are recreated per festival, so this is the main cross-festival retention signal.';
COMMENT ON COLUMN analytics.festival_retention.festival_id IS 'festivals.id.';
COMMENT ON COLUMN analytics.festival_retention.festival_name IS 'festivals.name.';
COMMENT ON COLUMN analytics.festival_retention.start_date IS 'festivals.start_date.';
COMMENT ON COLUMN analytics.festival_retention.attendees IS 'Distinct real users with at least one attendance at this festival.';
COMMENT ON COLUMN analytics.festival_retention.returned_next IS 'Of the attendees, how many attended the next festival by start_date (any type). NULL when there is no next festival or it has not started yet.';
COMMENT ON COLUMN analytics.festival_retention.returned_any IS 'Of the attendees, how many attended any festival that starts later.';

-- ---------------------------------------------------------------------------
-- analytics_overview
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_overview(
  p_from date,
  p_to date,
  p_platform text DEFAULT NULL
) RETURNS TABLE (day date, dau integer, wau integer, mau integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH days AS (
    SELECT g::date AS day
    FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') AS g
  ),
  activity AS (
    SELECT uad.user_id, uad.day
    FROM public.user_active_days uad
    JOIN analytics.real_users ru ON ru.user_id = uad.user_id
    WHERE uad.day BETWEEN p_from - 29 AND p_to
      AND (p_platform IS NULL OR uad.platform = p_platform)
  )
  SELECT
    d.day,
    (SELECT count(DISTINCT a.user_id) FROM activity a WHERE a.day = d.day)::integer,
    (SELECT count(DISTINCT a.user_id) FROM activity a WHERE a.day BETWEEN d.day - 6 AND d.day)::integer,
    (SELECT count(DISTINCT a.user_id) FROM activity a WHERE a.day BETWEEN d.day - 29 AND d.day)::integer
  FROM days d
  ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.analytics_overview(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_overview(date, date, text) TO service_role;

COMMENT ON FUNCTION public.analytics_overview(date, date, text) IS
  'Admin dashboard: one row per day in [p_from, p_to] with rolling 1/7/30-day distinct real users from user_active_days (a row there = the user made an authenticated API request that day). p_platform filters to ios or android; each user-day counts under the last platform seen that day, so multi-device users undercount per platform. service_role only.';

-- ---------------------------------------------------------------------------
-- analytics_feature_usage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_feature_usage(
  p_from date,
  p_to date,
  p_platform text DEFAULT NULL
) RETURNS TABLE (feature text, users integer, events integer, active_users integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH usage AS (
    SELECT 'attendance'::text AS feature, a.user_id
      FROM public.attendances a WHERE a.date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'drinks', a.user_id
      FROM public.consumptions c JOIN public.attendances a ON a.id = c.attendance_id
      WHERE c.recorded_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'photos', bp.user_id
      FROM public.beer_pictures bp WHERE bp.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'group_joins', gm.user_id
      FROM public.group_members gm WHERE gm.joined_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'group_messages', m.user_id
      FROM public.group_messages m WHERE m.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'photo_reactions', r.user_id
      FROM public.photo_reactions r WHERE r.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'photo_comments', pc.user_id
      FROM public.photo_comments pc WHERE pc.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'day_plans', dp.user_id
      FROM public.day_plans dp WHERE dp.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'crowd_reports', cr.user_id
      FROM public.tent_crowd_reports cr WHERE cr.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'friend_requests', f.requester_id
      FROM public.friendships f WHERE f.created_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'location_sharing', ls.user_id
      FROM public.location_sessions ls WHERE ls.started_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT 'wrapped', wv.user_id
      FROM public.wrapped_views wv WHERE wv.first_viewed_at::date BETWEEN p_from AND p_to
  ),
  -- Real users active in the range, on p_platform when given: the reach
  -- denominator, and the population whose feature usage counts
  active_users AS (
    SELECT DISTINCT uad.user_id
    FROM public.user_active_days uad
    JOIN analytics.real_users ru ON ru.user_id = uad.user_id
    WHERE uad.day BETWEEN p_from AND p_to
      AND (p_platform IS NULL OR uad.platform = p_platform)
  ),
  real_usage AS (
    SELECT u.feature, u.user_id
    FROM usage u
    JOIN analytics.real_users ru ON ru.user_id = u.user_id
    WHERE p_platform IS NULL OR u.user_id IN (SELECT au.user_id FROM active_users au)
  ),
  features (feature) AS (
    VALUES ('attendance'), ('drinks'), ('photos'), ('group_joins'), ('group_messages'),
           ('photo_reactions'), ('photo_comments'), ('day_plans'), ('crowd_reports'),
           ('friend_requests'), ('location_sharing'), ('wrapped')
  ),
  active AS (
    SELECT count(*)::integer AS n FROM active_users
  )
  SELECT
    f.feature,
    count(DISTINCT ru.user_id)::integer AS users,
    count(ru.user_id)::integer AS events,
    (SELECT n FROM active) AS active_users
  FROM features f
  LEFT JOIN real_usage ru ON ru.feature = f.feature
  GROUP BY f.feature
  ORDER BY users DESC, f.feature ASC;
$$;

REVOKE ALL ON FUNCTION public.analytics_feature_usage(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_feature_usage(date, date, text) TO service_role;

COMMENT ON FUNCTION public.analytics_feature_usage(date, date, text) IS
  'Admin dashboard: per feature, distinct real users and row count of that feature''s domain table within [p_from, p_to]. active_users (same on every row) is distinct real users in user_active_days for the range, the denominator for reach. p_platform (ios or android) limits both to users active on that platform in the range; each user-day counts under the last platform seen that day. Feature names mirror ANALYTICS_FEATURES in packages/shared. service_role only.';

-- ---------------------------------------------------------------------------
-- analytics_activation_funnel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_activation_funnel(
  p_from date,
  p_to date,
  p_platform text DEFAULT NULL
) RETURNS TABLE (step text, users integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH cohort AS (
    SELECT ru.user_id
    FROM analytics.real_users ru
    WHERE ru.signed_up_at::date BETWEEN p_from AND p_to
      AND (
        p_platform IS NULL
        OR EXISTS (
          SELECT 1 FROM public.user_active_days uad
          WHERE uad.user_id = ru.user_id AND uad.platform = p_platform
        )
      )
  ),
  attendance_days AS (
    SELECT a.user_id, count(DISTINCT a.date) AS days
    FROM public.attendances a
    JOIN cohort c ON c.user_id = a.user_id
    GROUP BY a.user_id
  ),
  steps AS (
    SELECT 1 AS ord, 'signed_up'::text AS step, (SELECT count(*) FROM cohort)::integer AS users
    UNION ALL
    SELECT 2, 'logged_attendance', (SELECT count(*) FROM attendance_days)::integer
    UNION ALL
    SELECT 3, 'five_days', (SELECT count(*) FROM attendance_days ad WHERE ad.days >= 5)::integer
  )
  SELECT s.step, s.users FROM steps s ORDER BY s.ord;
$$;

REVOKE ALL ON FUNCTION public.analytics_activation_funnel(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_activation_funnel(date, date, text) TO service_role;

COMMENT ON FUNCTION public.analytics_activation_funnel(date, date, text) IS
  'Admin dashboard: real users who signed up in [p_from, p_to], how many of them ever logged an attendance, and how many logged 5+ distinct days. Later steps are not limited to the range. No signup platform is recorded, so p_platform (ios or android) limits the cohort to users ever active on that platform. service_role only.';

-- ---------------------------------------------------------------------------
-- analytics_festival_retention
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_festival_retention()
RETURNS TABLE (
  festival_id uuid,
  festival_name text,
  start_date date,
  attendees integer,
  returned_next integer,
  returned_any integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    fr.festival_id,
    fr.festival_name,
    fr.start_date,
    fr.attendees,
    fr.returned_next,
    fr.returned_any
  FROM analytics.festival_retention fr
  ORDER BY fr.start_date DESC, fr.festival_id;
$$;

REVOKE ALL ON FUNCTION public.analytics_festival_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_festival_retention() TO service_role;

COMMENT ON FUNCTION public.analytics_festival_retention() IS
  'Admin dashboard: analytics.festival_retention, newest festival first. service_role only.';
