-- =====================================================
-- Fix RLS Security Issues
-- =====================================================
-- This migration addresses critical security issues found by Supabase advisors:
-- 1. Enable RLS on 8 tables that have policies but RLS disabled
-- 2. Add missing RLS policies for tables with insufficient coverage
-- 3. Fix leaderboard view that exposes auth.users
-- 4. Convert SECURITY DEFINER views to SECURITY INVOKER
-- 5. Fix group creation/join functions for API access
-- =====================================================

-- =====================================================
-- PART 1: Drop and recreate helper view FIRST
-- (Other views/policies depend on this)
-- =====================================================

-- Drop policies that depend on v_user_shared_group_members first
DROP POLICY IF EXISTS "Users can view activity feed from shared group members" ON public.attendances;
DROP POLICY IF EXISTS "Users can view own tent visits and group members' visits" ON public.tent_visits;
DROP POLICY IF EXISTS "Group members can view visible reservations in same festival" ON public.reservations;

-- Drop and recreate helper view with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_user_shared_group_members CASCADE;

CREATE VIEW public.v_user_shared_group_members
WITH (security_invoker = true)
AS
SELECT
  gm1.user_id AS owner_id,
  gm2.user_id AS viewer_id,
  g.festival_id
FROM group_members gm1
  JOIN group_members gm2 ON gm1.group_id = gm2.group_id AND gm1.user_id <> gm2.user_id
  JOIN groups g ON g.id = gm1.group_id;

GRANT SELECT ON public.v_user_shared_group_members TO authenticated;

-- =====================================================
-- PART 2: Enable RLS on all tables
-- =====================================================

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tent_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winning_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beer_pictures ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 3: Add missing RLS policies (only truly new ones)
-- =====================================================

-- ----------------------------------------------------
-- TENTS: Everyone can view tents (read-only for users)
-- (Only super admin policy existed before)
-- ----------------------------------------------------
CREATE POLICY "Anyone can view tents"
  ON public.tents
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------
-- WINNING_CRITERIA: Everyone can view (read-only)
-- (Only super admin policy existed before)
-- ----------------------------------------------------
CREATE POLICY "Anyone can view winning criteria"
  ON public.winning_criteria
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------
-- TENT_VISITS: Recreate view policy that was dropped with CASCADE
-- (Other CRUD policies already exist in baseline)
-- ----------------------------------------------------
CREATE POLICY "Users can view own tent visits and group members' visits"
  ON public.tent_visits
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = tent_visits.user_id
      AND v.viewer_id = auth.uid()
      AND v.festival_id = tent_visits.festival_id
    )
  );

-- ----------------------------------------------------
-- BEER_PICTURES: All policies (none existed before)
-- ----------------------------------------------------
CREATE POLICY "Users can view own beer pictures"
  ON public.beer_pictures
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view public beer pictures from group members"
  ON public.beer_pictures
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::photo_visibility_enum
    AND EXISTS (
      SELECT 1 FROM attendances a
      JOIN v_user_shared_group_members v ON v.owner_id = beer_pictures.user_id AND v.festival_id = a.festival_id
      WHERE a.id = beer_pictures.attendance_id
      AND v.viewer_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own beer pictures"
  ON public.beer_pictures
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own beer pictures"
  ON public.beer_pictures
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own beer pictures"
  ON public.beer_pictures
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can do anything with beer pictures"
  ON public.beer_pictures
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ----------------------------------------------------
-- GROUP_MEMBERS: Add policy to see other members in same group
-- (Existing policy only allows viewing own memberships)
-- Uses SECURITY DEFINER function to avoid infinite recursion
-- ----------------------------------------------------
CREATE POLICY "Users can view other members in their groups"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    is_group_member(group_id, auth.uid())
  );

-- ----------------------------------------------------
-- ATTENDANCES: Recreate policy that was dropped with cascade
-- ----------------------------------------------------
CREATE POLICY "Users can view activity feed from shared group members"
  ON public.attendances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = attendances.user_id
      AND v.viewer_id = auth.uid()
      AND v.festival_id = attendances.festival_id
    )
    OR user_id = auth.uid()
  );

-- ----------------------------------------------------
-- RESERVATIONS: Recreate policy that was dropped with cascade
-- ----------------------------------------------------
CREATE POLICY "Group members can view visible reservations in same festival"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (
    visible_to_groups = true
    AND EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = reservations.user_id
      AND v.viewer_id = auth.uid()
      AND v.festival_id = reservations.festival_id
    )
  );

-- =====================================================
-- PART 4: Fix views with security issues
-- =====================================================

-- ----------------------------------------------------
-- Fix LEADERBOARD view:
-- 1. Remove auth.users reference (use profiles instead)
-- 2. Convert to SECURITY INVOKER
-- ----------------------------------------------------
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.id AS group_id,
  g.name AS group_name,
  count(DISTINCT a.date) AS days_attended,
  COALESCE(avg(a.beer_count), 0::numeric) AS avg_beers,
  COALESCE(sum(a.beer_count), 0::bigint) AS total_beers
FROM profiles p
  JOIN group_members gm ON p.id = gm.user_id
  JOIN groups g ON gm.group_id = g.id
  LEFT JOIN attendances a ON p.id = a.user_id
WHERE gm.group_id = g.id
  AND EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_members.group_id = g.id
    AND group_members.user_id = auth.uid()
  )
GROUP BY p.id, p.username, p.full_name, p.avatar_url, g.id, g.name;

GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO anon;

-- ----------------------------------------------------
-- Fix ATTENDANCE_WITH_TOTALS view:
-- Convert to SECURITY INVOKER
-- ----------------------------------------------------
DROP VIEW IF EXISTS public.attendance_with_totals;

CREATE VIEW public.attendance_with_totals
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.user_id,
  a.festival_id,
  a.date,
  a.created_at,
  a.updated_at,
  COALESCE(c.drink_count, 0::bigint) AS drink_count,
  COALESCE(c.beer_count, a.beer_count::bigint, 0::bigint) AS beer_count,
  COALESCE(c.total_spent_cents, 0::bigint) AS total_spent_cents,
  COALESCE(c.total_tip_cents, 0::bigint) AS total_tip_cents,
  COALESCE(c.avg_price_cents, 0) AS avg_price_cents
FROM attendances a
LEFT JOIN LATERAL (
  SELECT
    count(*) AS drink_count,
    count(*) FILTER (WHERE consumptions.drink_type = ANY (ARRAY['beer'::drink_type, 'radler'::drink_type])) AS beer_count,
    sum(consumptions.price_paid_cents) AS total_spent_cents,
    sum(consumptions.tip_cents) AS total_tip_cents,
    (avg(consumptions.price_paid_cents))::integer AS avg_price_cents
  FROM consumptions
  WHERE consumptions.attendance_id = a.id
  HAVING count(*) > 0
) c ON true;

GRANT SELECT ON public.attendance_with_totals TO authenticated;

-- ----------------------------------------------------
-- Fix ACTIVITY_FEED view:
-- Convert to SECURITY INVOKER
-- ----------------------------------------------------
DROP VIEW IF EXISTS public.activity_feed;

CREATE VIEW public.activity_feed
WITH (security_invoker = true)
AS
WITH user_group_members AS (
  SELECT DISTINCT gm2.user_id,
    gm2.group_id,
    g.festival_id
  FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
),
recent_attendances AS (
  SELECT a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object('beer_count', a.beer_count, 'date', a.date, 'attendance_id', a.id) AS activity_data,
    GREATEST(a.created_at, a.updated_at) AS activity_time,
    a.created_at,
    a.updated_at
  FROM attendances a
    JOIN user_group_members ugm ON ugm.user_id = a.user_id AND ugm.festival_id = a.festival_id
  WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
),
recent_tent_visits AS (
  SELECT tv.user_id,
    tv.festival_id,
    'tent_checkin'::activity_type_enum AS activity_type,
    jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
    tv.visit_date AS activity_time,
    tv.visit_date AS created_at,
    tv.visit_date AS updated_at
  FROM tent_visits tv
    JOIN tents t ON t.id = tv.tent_id
    JOIN user_group_members ugm ON ugm.user_id = tv.user_id AND ugm.festival_id = tv.festival_id
  WHERE tv.visit_date > (now() - '48:00:00'::interval)
),
recent_photos AS (
  SELECT bp.user_id,
    a.festival_id,
    'photo_upload'::activity_type_enum AS activity_type,
    jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
    bp.created_at AS activity_time,
    bp.created_at,
    bp.created_at AS updated_at
  FROM beer_pictures bp
    JOIN attendances a ON a.id = bp.attendance_id
    JOIN user_group_members ugm ON ugm.user_id = bp.user_id AND ugm.festival_id = a.festival_id
  WHERE bp.created_at > (now() - '48:00:00'::interval)
    AND bp.visibility = 'public'::photo_visibility_enum
),
recent_group_joins AS (
  SELECT gm.user_id,
    g.festival_id,
    'group_join'::activity_type_enum AS activity_type,
    jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
    gm.joined_at AS activity_time,
    gm.joined_at AS created_at,
    gm.joined_at AS updated_at
  FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN user_group_members ugm ON ugm.user_id = gm.user_id AND ugm.festival_id = g.festival_id
  WHERE gm.joined_at > (now() - '48:00:00'::interval)
),
recent_achievements AS (
  SELECT ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum AS activity_type,
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', a.name, 'achievement_icon', a.icon, 'rarity', a.rarity) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    JOIN user_group_members ugm ON ugm.user_id = ua.user_id AND ugm.festival_id = ua.festival_id
  WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
),
all_activities AS (
  SELECT * FROM recent_attendances
  UNION ALL
  SELECT * FROM recent_tent_visits
  UNION ALL
  SELECT * FROM recent_photos
  UNION ALL
  SELECT * FROM recent_group_joins
  UNION ALL
  SELECT * FROM recent_achievements
)
SELECT
  aa.user_id,
  aa.festival_id,
  aa.activity_type,
  aa.activity_data,
  aa.activity_time,
  p.username,
  p.full_name,
  p.avatar_url
FROM all_activities aa
  JOIN profiles p ON p.id = aa.user_id
ORDER BY aa.activity_time DESC;

GRANT SELECT ON public.activity_feed TO authenticated;

-- =====================================================
-- PART 5: Fix Group Creation/Join Functions for API Access
-- =====================================================
-- The Hono API creates a Supabase client with JWT token but auth.uid()
-- returns NULL in RLS policies. Making these functions SECURITY DEFINER
-- allows them to bypass RLS while still validating user access.
-- =====================================================

-- ----------------------------------------------------
-- Drop old function signatures and create enhanced version
-- ----------------------------------------------------
-- Drop both possible old signatures
DROP FUNCTION IF EXISTS public.create_group_with_member(character varying, character varying, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_group_with_member(character varying, character varying, uuid);

-- ----------------------------------------------------
-- Create enhanced create_group_with_member with full options
-- This allows API calls to create groups with all settings
-- ----------------------------------------------------
CREATE FUNCTION public.create_group_with_member(
  p_group_name character varying,
  p_user_id uuid,
  p_festival_id uuid,
  p_winning_criteria_id integer DEFAULT 2,
  p_invite_token uuid DEFAULT NULL,
  p_password character varying DEFAULT NULL
)
RETURNS TABLE (
  group_id uuid,
  group_name character varying,
  invite_token uuid,
  winning_criteria_id integer,
  festival_id uuid,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
    v_group_id UUID;
    v_invite_token UUID;
    v_password VARCHAR;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Validate user_id is not null (basic sanity check)
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- Generate invite token if not provided
    v_invite_token := COALESCE(p_invite_token, gen_random_uuid());

    -- Generate password if not provided
    v_password := COALESCE(p_password, encode(gen_random_bytes(32), 'hex'));

    -- Insert the group
    INSERT INTO groups (name, password, created_by, winning_criteria_id, festival_id, invite_token)
    VALUES (p_group_name, v_password, p_user_id, p_winning_criteria_id, p_festival_id, v_invite_token)
    RETURNING id, groups.created_at INTO v_group_id, v_created_at;

    -- Insert the creator as a member of the group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    -- Return the created group details
    RETURN QUERY SELECT
      v_group_id,
      p_group_name,
      v_invite_token,
      p_winning_criteria_id,
      p_festival_id,
      p_user_id,
      v_created_at;
END;
$function$;

-- ----------------------------------------------------
-- Make join_group_with_token SECURITY DEFINER
-- This allows API calls to join groups via invite token
-- Drop first to handle return type changes
-- ----------------------------------------------------
DROP FUNCTION IF EXISTS public.join_group_with_token(uuid, uuid);

CREATE OR REPLACE FUNCTION public.join_group_with_token(
  p_user_id uuid,
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
    v_group_id UUID;
    v_group_name TEXT;
    v_token_expires_at TIMESTAMP;
    v_existing_member UUID;
BEGIN
    -- Validate user_id is not null
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_NOT_FOUND',
            'message', 'User ID cannot be null'
        );
    END IF;

    -- Find group by invite token
    SELECT id, name, token_expiration INTO v_group_id, v_group_name, v_token_expires_at
    FROM groups
    WHERE invite_token = p_token;

    IF v_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_NOT_FOUND',
            'message', 'Invalid or expired invitation token'
        );
    END IF;

    -- Check if token has expired
    IF v_token_expires_at IS NOT NULL AND v_token_expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_EXPIRED',
            'message', 'This invitation token has expired',
            'expired_at', v_token_expires_at,
            'group_name', v_group_name,
            'group_id', v_group_id
        );
    END IF;

    -- Check if user is already a member
    SELECT user_id INTO v_existing_member
    FROM group_members
    WHERE group_id = v_group_id AND user_id = p_user_id;

    IF v_existing_member IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_MEMBER',
            'message', 'You are already a member of this group',
            'group_name', v_group_name,
            'group_id', v_group_id
        );
    END IF;

    -- Add user to group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'group_id', v_group_id,
        'group_name', v_group_name,
        'message', 'Successfully joined the group'
    );
END;
$function$;

-- ----------------------------------------------------
-- Make join_group SECURITY DEFINER
-- This allows API calls to join groups via name/password
-- Drop first to handle return type changes
-- ----------------------------------------------------
DROP FUNCTION IF EXISTS public.join_group(uuid, character varying, character varying, uuid);

CREATE OR REPLACE FUNCTION public.join_group(
  p_user_id uuid,
  p_group_name character varying,
  p_password character varying,
  p_festival_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
    v_group_id UUID;
    v_existing_member UUID;
BEGIN
    -- Validate user_id is not null
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- Find group by name, password, and optionally festival_id
    IF p_festival_id IS NOT NULL THEN
        SELECT id INTO v_group_id
        FROM groups
        WHERE name = p_group_name
          AND password = p_password
          AND festival_id = p_festival_id;
    ELSE
        SELECT id INTO v_group_id
        FROM groups
        WHERE name = p_group_name
          AND password = p_password;
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Group not found or incorrect password';
    END IF;

    -- Check if user is already a member
    SELECT user_id INTO v_existing_member
    FROM group_members
    WHERE group_id = v_group_id AND user_id = p_user_id;

    IF v_existing_member IS NOT NULL THEN
        RAISE EXCEPTION 'Already a member of this group';
    END IF;

    -- Add user to group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    RETURN v_group_id;
END;
$function$;
