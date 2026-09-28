-- Admin dashboard piece 3: feature scorecard and signup cohorts.
--
-- Same access model as analytics_dashboard_v0: service_role only, called by
-- the admin API through the service-role client. Both functions return raw
-- counts; percentages, lift and the keep/grow/cut hint are computed in
-- packages/shared/src/utils/analytics-scorecard.ts so both apps share them.
-- Supabase default privileges grant new functions to anon and authenticated
-- directly, so both roles are revoked by name.

-- ---------------------------------------------------------------------------
-- analytics_feature_scorecard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_feature_scorecard(
  p_festival_id uuid DEFAULT NULL
) RETURNS TABLE (
  feature text,
  attendees integer,
  adopters integer,
  came_back_users integer,
  came_back_users_base integer,
  came_back_non_users integer,
  came_back_non_users_base integer,
  returned_users integer,
  returned_users_base integer,
  returned_non_users integer,
  returned_non_users_base integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH fest AS (
    SELECT
      f.id,
      f.start_date,
      f.end_date,
      f.timezone AS tz,
      EXISTS (
        SELECT 1 FROM public.festivals lf
        WHERE (lf.start_date, lf.id) > (f.start_date, f.id)
          AND lf.start_date <= current_date
      ) AS has_started_successor
    FROM public.festivals f
    WHERE p_festival_id IS NULL OR f.id = p_festival_id
  ),
  -- One row per (festival, real user) with at least one attendance there
  attendee AS (
    SELECT
      a.festival_id,
      a.user_id,
      min(a.date) AS first_day,
      max(a.date) AS last_day,
      fe.has_started_successor,
      EXISTS (
        SELECT 1
        FROM public.attendances la
        JOIN public.festivals lf ON lf.id = la.festival_id
        WHERE la.user_id = a.user_id
          AND (lf.start_date, lf.id) > (fe.start_date, fe.id)
      ) AS returned
    FROM public.attendances a
    JOIN analytics.real_users ru ON ru.user_id = a.user_id
    JOIN fest fe ON fe.id = a.festival_id
    GROUP BY a.festival_id, a.user_id, fe.has_started_successor, fe.start_date, fe.id
  ),
  -- Every use of a feature, tied to a festival, with its festival-local day
  uses AS (
    SELECT 'drinks'::text AS feature, a.festival_id, a.user_id, a.date AS use_day
      FROM public.consumptions c
      JOIN public.attendances a ON a.id = c.attendance_id
    UNION ALL
    SELECT 'photos', a.festival_id, bp.user_id, a.date
      FROM public.beer_pictures bp
      JOIN public.attendances a ON a.id = bp.attendance_id
    UNION ALL
    SELECT 'group_joins', fe.id, gm.user_id, (gm.joined_at AT TIME ZONE fe.tz)::date
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      JOIN fest fe ON fe.id = g.festival_id
    UNION ALL
    SELECT 'group_messages', fe.id, m.user_id, (m.created_at AT TIME ZONE fe.tz)::date
      FROM public.group_messages m
      JOIN fest fe ON fe.id = m.festival_id
    UNION ALL
    SELECT 'photo_reactions', fe.id, r.user_id, (r.created_at AT TIME ZONE fe.tz)::date
      FROM public.photo_reactions r
      JOIN public.groups g ON g.id = r.group_id
      JOIN fest fe ON fe.id = g.festival_id
    UNION ALL
    SELECT 'photo_comments', fe.id, pc.user_id, (pc.created_at AT TIME ZONE fe.tz)::date
      FROM public.photo_comments pc
      JOIN public.groups g ON g.id = pc.group_id
      JOIN fest fe ON fe.id = g.festival_id
    UNION ALL
    SELECT 'day_plans', fe.id, dp.user_id, (dp.created_at AT TIME ZONE fe.tz)::date
      FROM public.day_plans dp
      JOIN fest fe ON fe.id = dp.festival_id
    UNION ALL
    SELECT 'crowd_reports', fe.id, cr.user_id, (cr.created_at AT TIME ZONE fe.tz)::date
      FROM public.tent_crowd_reports cr
      JOIN fest fe ON fe.id = cr.festival_id
    UNION ALL
    -- Friend requests have no festival: matched by the festival's local dates
    SELECT 'friend_requests', fe.id, fr.requester_id, (fr.created_at AT TIME ZONE fe.tz)::date
      FROM public.friendships fr
      JOIN fest fe
        ON (fr.created_at AT TIME ZONE fe.tz)::date BETWEEN fe.start_date AND fe.end_date
    UNION ALL
    SELECT 'location_sharing', fe.id, ls.user_id, (ls.started_at AT TIME ZONE fe.tz)::date
      FROM public.location_sessions ls
      JOIN fest fe ON fe.id = ls.festival_id
    UNION ALL
    SELECT 'wrapped', fe.id, wv.user_id, (wv.first_viewed_at AT TIME ZONE fe.tz)::date
      FROM public.wrapped_views wv
      JOIN fest fe ON fe.id = wv.festival_id
  ),
  first_use AS (
    SELECT u.feature, u.festival_id, u.user_id, min(u.use_day) AS first_use_day
    FROM uses u
    GROUP BY u.feature, u.festival_id, u.user_id
  ),
  features (feature) AS (
    VALUES ('drinks'), ('photos'), ('group_joins'), ('group_messages'), ('photo_reactions'),
           ('photo_comments'), ('day_plans'), ('crowd_reports'), ('friend_requests'),
           ('location_sharing'), ('wrapped')
  ),
  pairs AS (
    SELECT
      ft.feature,
      at.user_id,
      at.last_day,
      at.has_started_successor,
      at.returned,
      fu.user_id IS NOT NULL AS is_user,
      -- Uses before the festival (joining a group the week before) count from
      -- the first attendance day
      greatest(fu.first_use_day, at.first_day) AS user_reference_day,
      at.first_day
    FROM features ft
    CROSS JOIN attendee at
    LEFT JOIN first_use fu
      ON fu.feature = ft.feature
     AND fu.festival_id = at.festival_id
     AND fu.user_id = at.user_id
  )
  SELECT
    ft.feature,
    count(p.user_id)::integer AS attendees,
    (count(*) FILTER (WHERE p.is_user))::integer AS adopters,
    (count(*) FILTER (WHERE p.is_user AND p.last_day > p.user_reference_day))::integer
      AS came_back_users,
    (count(*) FILTER (WHERE p.is_user))::integer AS came_back_users_base,
    (count(*) FILTER (WHERE NOT p.is_user AND p.last_day > p.first_day))::integer
      AS came_back_non_users,
    (count(*) FILTER (WHERE NOT p.is_user))::integer AS came_back_non_users_base,
    (count(*) FILTER (WHERE p.is_user AND p.has_started_successor AND p.returned))::integer
      AS returned_users,
    (count(*) FILTER (WHERE p.is_user AND p.has_started_successor))::integer
      AS returned_users_base,
    (count(*) FILTER (WHERE NOT p.is_user AND p.has_started_successor AND p.returned))::integer
      AS returned_non_users,
    (count(*) FILTER (WHERE NOT p.is_user AND p.has_started_successor))::integer
      AS returned_non_users_base
  FROM features ft
  LEFT JOIN pairs p ON p.feature = ft.feature
  GROUP BY ft.feature
  ORDER BY adopters DESC, ft.feature ASC;
$$;

REVOKE ALL ON FUNCTION public.analytics_feature_scorecard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_feature_scorecard(uuid) TO service_role;

COMMENT ON FUNCTION public.analytics_feature_scorecard(uuid) IS
  'Per feature (11 rows, attendance excluded): attendees of the festival (or of every festival, pooled, when p_festival_id is NULL), how many used the feature there, and for users vs non-users how many logged another day after their reference day and how many attended a later festival. Raw counts only; the hint is computed in shared code. Real users only. service_role only.';

-- ---------------------------------------------------------------------------
-- analytics_signup_cohorts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_signup_cohorts()
RETURNS TABLE (
  month date,
  signups integer,
  activated integer,
  activated_7d integer,
  engaged integer,
  returned integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH per_user AS (
    SELECT
      date_trunc('month', ru.signed_up_at AT TIME ZONE 'Europe/Berlin')::date AS month,
      ru.signed_up_at,
      (SELECT min(a.created_at) FROM public.attendances a WHERE a.user_id = ru.user_id)
        AS first_attendance_at,
      EXISTS (
        SELECT 1 FROM public.attendances a
        WHERE a.user_id = ru.user_id
        GROUP BY a.festival_id
        HAVING count(DISTINCT a.date) >= 3
      ) AS engaged,
      (SELECT count(DISTINCT a.festival_id) FROM public.attendances a WHERE a.user_id = ru.user_id)
        >= 2 AS returned
    FROM analytics.real_users ru
  )
  SELECT
    pu.month,
    count(*)::integer AS signups,
    count(pu.first_attendance_at)::integer AS activated,
    (count(*) FILTER (
      WHERE pu.first_attendance_at < pu.signed_up_at + interval '7 days'
    ))::integer AS activated_7d,
    (count(*) FILTER (WHERE pu.engaged))::integer AS engaged,
    (count(*) FILTER (WHERE pu.returned))::integer AS returned
  FROM per_user pu
  GROUP BY pu.month
  ORDER BY pu.month DESC;
$$;

REVOKE ALL ON FUNCTION public.analytics_signup_cohorts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_signup_cohorts() TO service_role;

COMMENT ON FUNCTION public.analytics_signup_cohorts() IS
  'One row per signup month (Europe/Berlin), newest first: real users who signed up, how many ever logged an attendance, how many logged one within 7 days of signing up (by attendances.created_at), how many logged 3+ days at a single festival, and how many attended 2+ festivals. service_role only.';
