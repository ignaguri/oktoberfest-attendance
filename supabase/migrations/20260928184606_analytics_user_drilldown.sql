-- Admin dashboard piece 2: user drill-down and timeline.
--
-- Each drillable aggregate now counts over a *_members function that returns
-- one row per person behind its numbers, so a list and its number share one
-- definition. The aggregates keep their signatures and output. The filters
-- that pick a list out of a members function live in
-- packages/shared/src/utils/analytics-drilldown.ts; the integration test
-- analytics-drilldown.integration.test.ts checks every list against its number.
--
-- Same access model as analytics_dashboard_v0: service_role only. Supabase
-- default privileges grant new functions to anon and authenticated directly,
-- so both roles are revoked by name.

-- ---------------------------------------------------------------------------
-- Activation funnel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_funnel_members(
  p_from date,
  p_to date,
  p_platform text DEFAULT NULL
) RETURNS TABLE (user_id uuid, attendance_days integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ru.user_id,
    (SELECT count(DISTINCT a.date) FROM public.attendances a WHERE a.user_id = ru.user_id)::integer
      AS attendance_days
  FROM analytics.real_users ru
  WHERE ru.signed_up_at::date BETWEEN p_from AND p_to
    AND (
      p_platform IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_active_days uad
        WHERE uad.user_id = ru.user_id AND uad.platform = p_platform
      )
    );
$$;

REVOKE ALL ON FUNCTION public.analytics_funnel_members(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_funnel_members(date, date, text) TO service_role;

COMMENT ON FUNCTION public.analytics_funnel_members(date, date, text) IS
  'Admin drill-down: the activation funnel cohort (real users who signed up in [p_from, p_to], limited to users ever active on p_platform when given), one row each, with their distinct attendance days at any festival. analytics_activation_funnel counts over it. service_role only.';

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
  WITH m AS (
    SELECT fm.attendance_days FROM public.analytics_funnel_members(p_from, p_to, p_platform) fm
  ),
  steps AS (
    SELECT 1 AS ord, 'signed_up'::text AS step, (SELECT count(*) FROM m)::integer AS users
    UNION ALL
    SELECT 2, 'logged_attendance', (SELECT count(*) FROM m WHERE m.attendance_days >= 1)::integer
    UNION ALL
    SELECT 3, 'five_days', (SELECT count(*) FROM m WHERE m.attendance_days >= 5)::integer
  )
  SELECT s.step, s.users FROM steps s ORDER BY s.ord;
$$;

REVOKE ALL ON FUNCTION public.analytics_activation_funnel(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_activation_funnel(date, date, text) TO service_role;

COMMENT ON FUNCTION public.analytics_activation_funnel(date, date, text) IS
  'Admin dashboard: real users who signed up in [p_from, p_to], how many of them ever logged an attendance, and how many logged 5+ distinct days. Later steps are not limited to the range. No signup platform is recorded, so p_platform (ios or android) limits the cohort to users ever active on that platform. Counts over analytics_funnel_members. service_role only.';

-- ---------------------------------------------------------------------------
-- Feature scorecard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_scorecard_members(
  p_festival_id uuid DEFAULT NULL
) RETURNS TABLE (
  feature text,
  festival_id uuid,
  festival_name text,
  user_id uuid,
  is_user boolean,
  came_back boolean,
  successor_started boolean,
  returned boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH fest AS (
    SELECT
      f.id,
      f.name,
      f.start_date,
      f.end_date,
      f.timezone AS tz,
      EXISTS (
        SELECT 1 FROM public.festivals lf
        WHERE (lf.start_date, lf.id) > (f.start_date, f.id)
          -- start_date is festival-local; current_date would be UTC
          AND lf.start_date <= (now() AT TIME ZONE lf.timezone)::date
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
  )
  SELECT
    ft.feature,
    at.festival_id,
    fe.name,
    at.user_id,
    fu.user_id IS NOT NULL AS is_user,
    -- Uses before the festival (joining a group the week before) count from
    -- the first attendance day
    CASE
      WHEN fu.user_id IS NOT NULL THEN at.last_day > greatest(fu.first_use_day, at.first_day)
      ELSE at.last_day > at.first_day
    END AS came_back,
    at.has_started_successor AS successor_started,
    at.returned
  FROM features ft
  CROSS JOIN attendee at
  JOIN fest fe ON fe.id = at.festival_id
  LEFT JOIN first_use fu
    ON fu.feature = ft.feature
   AND fu.festival_id = at.festival_id
   AND fu.user_id = at.user_id;
$$;

REVOKE ALL ON FUNCTION public.analytics_scorecard_members(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_scorecard_members(uuid) TO service_role;

COMMENT ON FUNCTION public.analytics_scorecard_members(uuid) IS
  'Admin drill-down: one row per (feature, festival attendee) of the festival (or of every festival when p_festival_id is NULL, so a person at two festivals is two rows per feature). is_user: used the feature there; came_back: logged a day after their reference day; successor_started: a later festival has started; returned: attended a later festival. Real users only. analytics_feature_scorecard counts over it. service_role only.';

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
  WITH features (feature) AS (
    VALUES ('drinks'), ('photos'), ('group_joins'), ('group_messages'), ('photo_reactions'),
           ('photo_comments'), ('day_plans'), ('crowd_reports'), ('friend_requests'),
           ('location_sharing'), ('wrapped')
  ),
  m AS (
    SELECT * FROM public.analytics_scorecard_members(p_festival_id)
  )
  SELECT
    ft.feature,
    count(m.user_id)::integer AS attendees,
    (count(*) FILTER (WHERE m.is_user))::integer AS adopters,
    (count(*) FILTER (WHERE m.is_user AND m.came_back))::integer AS came_back_users,
    (count(*) FILTER (WHERE m.is_user))::integer AS came_back_users_base,
    (count(*) FILTER (WHERE NOT m.is_user AND m.came_back))::integer AS came_back_non_users,
    (count(*) FILTER (WHERE NOT m.is_user))::integer AS came_back_non_users_base,
    (count(*) FILTER (WHERE m.is_user AND m.successor_started AND m.returned))::integer
      AS returned_users,
    (count(*) FILTER (WHERE m.is_user AND m.successor_started))::integer
      AS returned_users_base,
    (count(*) FILTER (WHERE NOT m.is_user AND m.successor_started AND m.returned))::integer
      AS returned_non_users,
    (count(*) FILTER (WHERE NOT m.is_user AND m.successor_started))::integer
      AS returned_non_users_base
  FROM features ft
  LEFT JOIN m ON m.feature = ft.feature
  GROUP BY ft.feature
  ORDER BY adopters DESC, ft.feature ASC;
$$;

REVOKE ALL ON FUNCTION public.analytics_feature_scorecard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_feature_scorecard(uuid) TO service_role;

COMMENT ON FUNCTION public.analytics_feature_scorecard(uuid) IS
  'Per feature (11 rows, attendance excluded): attendees of the festival (or of every festival, pooled, when p_festival_id is NULL), how many used the feature there, and for users vs non-users how many logged another day after their reference day and how many attended a later festival. Raw counts only; the hint is computed in shared code. Real users only. Counts over analytics_scorecard_members. service_role only.';

-- ---------------------------------------------------------------------------
-- Signup cohorts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_cohort_members()
RETURNS TABLE (
  user_id uuid,
  month date,
  activated boolean,
  activated_7d boolean,
  engaged boolean,
  returned boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH per_user AS (
    SELECT
      ru.user_id,
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
    pu.user_id,
    pu.month,
    pu.first_attendance_at IS NOT NULL AS activated,
    coalesce(pu.first_attendance_at < pu.signed_up_at + interval '7 days', false) AS activated_7d,
    pu.engaged,
    pu.returned
  FROM per_user pu;
$$;

REVOKE ALL ON FUNCTION public.analytics_cohort_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_cohort_members() TO service_role;

COMMENT ON FUNCTION public.analytics_cohort_members() IS
  'Admin drill-down: one row per real user with their signup month (Europe/Berlin) and whether they ever logged an attendance, logged one within 7 days of signing up (by attendances.created_at), logged 3+ days at a single festival, and attended 2+ festivals. analytics_signup_cohorts counts over it. service_role only.';

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
  SELECT
    cm.month,
    count(*)::integer AS signups,
    (count(*) FILTER (WHERE cm.activated))::integer AS activated,
    (count(*) FILTER (WHERE cm.activated_7d))::integer AS activated_7d,
    (count(*) FILTER (WHERE cm.engaged))::integer AS engaged,
    (count(*) FILTER (WHERE cm.returned))::integer AS returned
  FROM public.analytics_cohort_members() cm
  GROUP BY cm.month
  ORDER BY cm.month DESC;
$$;

REVOKE ALL ON FUNCTION public.analytics_signup_cohorts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_signup_cohorts() TO service_role;

COMMENT ON FUNCTION public.analytics_signup_cohorts() IS
  'One row per signup month (Europe/Berlin), newest first: real users who signed up, how many ever logged an attendance, how many logged one within 7 days of signing up (by attendances.created_at), how many logged 3+ days at a single festival, and how many attended 2+ festivals. Counts over analytics_cohort_members. service_role only.';

-- ---------------------------------------------------------------------------
-- Member display fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_member_profiles(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  signed_up_at timestamptz,
  last_active_day date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    p.username,
    p.full_name,
    u.created_at,
    (SELECT max(uad.day) FROM public.user_active_days uad WHERE uad.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = ANY (p_user_ids);
$$;

REVOKE ALL ON FUNCTION public.analytics_member_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_member_profiles(uuid[]) TO service_role;

COMMENT ON FUNCTION public.analytics_member_profiles(uuid[]) IS
  'Admin drill-down: display fields for a member list (username, full name, auth signup time, last day in user_active_days). No email. service_role only.';

-- ---------------------------------------------------------------------------
-- User timeline
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_user_timeline(
  p_user_id uuid,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_key text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_kind text DEFAULT NULL
) RETURNS TABLE (
  occurred_at timestamptz,
  kind text,
  name text,
  props jsonb,
  festival_id uuid,
  festival_name text,
  platform text,
  app_version text,
  session_id uuid,
  cursor_key text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH timeline_rows AS (
    SELECT e.occurred_at, 'event'::text AS kind, e.name, e.props, NULL::uuid AS festival_id,
           e.platform, e.app_version, e.session_id, 'event:' || e.id::text AS cursor_key
      FROM analytics.events e
      WHERE e.user_id = p_user_id
    UNION ALL
    SELECT u.created_at, 'action', 'signed_up', '{}'::jsonb, NULL, NULL, NULL, NULL,
           'signed_up:' || u.id::text
      FROM auth.users u
      WHERE u.id = p_user_id
    UNION ALL
    SELECT coalesce(a.created_at, (a.date + time '12:00') AT TIME ZONE f.timezone), 'action',
           'attendance', jsonb_build_object('date', a.date), a.festival_id, NULL, NULL, NULL,
           'attendance:' || a.id::text
      FROM public.attendances a
      JOIN public.festivals f ON f.id = a.festival_id
      WHERE a.user_id = p_user_id
    UNION ALL
    SELECT c.created_at, 'action', 'drink', jsonb_build_object('drink_type', c.drink_type),
           a.festival_id, NULL, NULL, NULL, 'drink:' || c.id::text
      FROM public.consumptions c
      JOIN public.attendances a ON a.id = c.attendance_id
      WHERE a.user_id = p_user_id
    UNION ALL
    SELECT bp.created_at, 'action', 'photo', '{}'::jsonb, a.festival_id, NULL, NULL, NULL,
           'photo:' || bp.id::text
      FROM public.beer_pictures bp
      LEFT JOIN public.attendances a ON a.id = bp.attendance_id
      WHERE bp.user_id = p_user_id
    UNION ALL
    SELECT gm.joined_at, 'action', 'group_join', jsonb_build_object('group_id', gm.group_id),
           g.festival_id, NULL, NULL, NULL, 'group_join:' || gm.id::text
      FROM public.group_members gm
      LEFT JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = p_user_id AND gm.joined_at IS NOT NULL
    UNION ALL
    -- Never select the message body
    SELECT m.created_at, 'action', 'group_message', '{}'::jsonb, m.festival_id, NULL, NULL, NULL,
           'group_message:' || m.id::text
      FROM public.group_messages m
      WHERE m.user_id = p_user_id
    UNION ALL
    SELECT r.created_at, 'action', 'photo_reaction', '{}'::jsonb, g.festival_id, NULL, NULL, NULL,
           'photo_reaction:' || r.id::text
      FROM public.photo_reactions r
      LEFT JOIN public.groups g ON g.id = r.group_id
      WHERE r.user_id = p_user_id
    UNION ALL
    -- Never select the comment body
    SELECT pc.created_at, 'action', 'photo_comment', '{}'::jsonb, g.festival_id, NULL, NULL, NULL,
           'photo_comment:' || pc.id::text
      FROM public.photo_comments pc
      LEFT JOIN public.groups g ON g.id = pc.group_id
      WHERE pc.user_id = p_user_id
    UNION ALL
    SELECT dp.created_at, 'action', 'day_plan', '{}'::jsonb, dp.festival_id, NULL, NULL, NULL,
           'day_plan:' || dp.id::text
      FROM public.day_plans dp
      WHERE dp.user_id = p_user_id AND dp.created_at IS NOT NULL
    UNION ALL
    SELECT cr.created_at, 'action', 'crowd_report', '{}'::jsonb, cr.festival_id, NULL, NULL, NULL,
           'crowd_report:' || cr.id::text
      FROM public.tent_crowd_reports cr
      WHERE cr.user_id = p_user_id
    UNION ALL
    SELECT fr.created_at, 'action', 'friend_request', '{}'::jsonb, NULL, NULL, NULL, NULL,
           'friend_request:' || fr.id::text
      FROM public.friendships fr
      WHERE fr.requester_id = p_user_id
    UNION ALL
    SELECT ls.started_at, 'action', 'location_sharing', '{}'::jsonb, ls.festival_id, NULL, NULL,
           NULL, 'location_sharing:' || ls.id::text
      FROM public.location_sessions ls
      WHERE ls.user_id = p_user_id
    UNION ALL
    SELECT wv.first_viewed_at, 'action', 'wrapped_view', '{}'::jsonb, wv.festival_id, NULL, NULL,
           NULL, 'wrapped_view:' || wv.festival_id::text
      FROM public.wrapped_views wv
      WHERE wv.user_id = p_user_id
  )
  SELECT
    t.occurred_at,
    t.kind,
    t.name,
    t.props,
    t.festival_id,
    f.name,
    t.platform,
    t.app_version,
    t.session_id,
    t.cursor_key
  FROM timeline_rows t
  LEFT JOIN public.festivals f ON f.id = t.festival_id
  WHERE (p_kind IS NULL OR t.kind = p_kind)
    AND (p_cursor_at IS NULL OR (t.occurred_at, t.cursor_key) < (p_cursor_at, p_cursor_key))
  ORDER BY t.occurred_at DESC, t.cursor_key DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.analytics_user_timeline(uuid, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_user_timeline(uuid, timestamptz, text, integer, text) TO service_role;

COMMENT ON FUNCTION public.analytics_user_timeline(uuid, timestamptz, text, integer, text) IS
  'Admin drill-down: one user''s usage events (kind event) and domain actions (kind action), newest first, by (occurred_at, cursor_key). Page with the last row''s (occurred_at, cursor_key) as the cursor. p_kind (event or action) filters before the limit; p_limit is clamped to 1..200. Props never carry message or comment bodies. Not limited to real users. service_role only.';
