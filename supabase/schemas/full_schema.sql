--
-- PostgreSQL database dump
--

\restrict DlBhWi9SJyObQUTF2pn09KZfUBhGsN8VSKBvvddFLNmkUL3KX1lXbvM0XhGTnjp

-- Dumped from database version 15.8
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: achievement_category_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.achievement_category_enum AS ENUM (
    'consumption',
    'attendance',
    'explorer',
    'social',
    'competitive',
    'special'
);


ALTER TYPE public.achievement_category_enum OWNER TO postgres;

--
-- Name: achievement_rarity_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.achievement_rarity_enum AS ENUM (
    'common',
    'rare',
    'epic',
    'legendary'
);


ALTER TYPE public.achievement_rarity_enum OWNER TO postgres;

--
-- Name: activity_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activity_type_enum AS ENUM (
    'beer_count_update',
    'tent_checkin',
    'photo_upload',
    'group_join',
    'achievement_unlock'
);


ALTER TYPE public.activity_type_enum OWNER TO postgres;

--
-- Name: drink_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.drink_type AS ENUM (
    'beer',
    'radler',
    'alcohol_free',
    'wine',
    'soft_drink',
    'other'
);


ALTER TYPE public.drink_type OWNER TO postgres;

--
-- Name: TYPE drink_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TYPE public.drink_type IS 'Types of drinks that can be consumed and tracked';


--
-- Name: festival_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.festival_status_enum AS ENUM (
    'upcoming',
    'active',
    'ended'
);


ALTER TYPE public.festival_status_enum OWNER TO postgres;

--
-- Name: festival_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.festival_type_enum AS ENUM (
    'oktoberfest',
    'starkbierfest',
    'fruehlingsfest',
    'other'
);


ALTER TYPE public.festival_type_enum OWNER TO postgres;

--
-- Name: location_sharing_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.location_sharing_status_enum AS ENUM (
    'active',
    'paused',
    'expired'
);


ALTER TYPE public.location_sharing_status_enum OWNER TO postgres;

--
-- Name: photo_visibility_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.photo_visibility_enum AS ENUM (
    'public',
    'private'
);


ALTER TYPE public.photo_visibility_enum OWNER TO postgres;

--
-- Name: add_beer_picture(uuid, uuid, text, public.photo_visibility_enum); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum DEFAULT 'public'::public.photo_visibility_enum) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_picture_id UUID;
BEGIN
    INSERT INTO beer_pictures (user_id, attendance_id, picture_url, visibility)
    VALUES (p_user_id, p_attendance_id, p_picture_url, p_visibility)
    RETURNING id INTO v_picture_id;

    RETURN v_picture_id;
END;
$$;


ALTER FUNCTION public.add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum) OWNER TO postgres;

--
-- Name: add_or_update_attendance_with_tents(uuid, timestamp with time zone, integer, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) RETURNS TABLE(attendance_id uuid, tents_changed boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_last_tent_id UUID;
    v_tents_changed BOOLEAN := FALSE;
BEGIN
    -- Insert or update the attendance record
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date::date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- If no tent IDs provided, just return (tent-less attendance)
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        RETURN QUERY SELECT v_attendance_id, FALSE;
        RETURN;
    END IF;

    -- Fetch existing tent visits for the user and date
    SELECT array_agg(tent_id ORDER BY visit_date DESC) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get the last tent ID if any exist
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    -- Check if any of the new tents are different from existing ones
    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Check if the arrays are different (any new tent not in existing)
    IF NOT (p_tent_ids <@ v_existing_tent_ids) THEN
        v_tents_changed := TRUE;
    END IF;

    -- Insert new tent visits, but skip if the tent is the same as the last one
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        -- Only insert if this tent is different from the last tent visited
        IF v_last_tent_id IS NULL OR v_tent_id != v_last_tent_id THEN
            INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
            VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date, p_festival_id);
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_changed;
END;
$$;


ALTER FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) OWNER TO postgres;

--
-- Name: calculate_achievement_progress(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  achievement_record achievements;
  conditions jsonb;
  achievement_type text;
  target_value integer;
  current_value integer;
  comparison_op text;
  -- Variables for streak calculation
  v_min_days integer;
  v_max_streak integer;
  v_current_streak integer;
  v_prev_date date;
  v_attendance_date date;
  -- Variables for special achievements
  v_festival_days integer;
  v_days_attended integer;
  v_festival_start date;
  v_festival_end date;
BEGIN
  SELECT * INTO achievement_record
  FROM achievements
  WHERE id = p_achievement_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  conditions := achievement_record.conditions;
  achievement_type := conditions->>'type';
  target_value := (conditions->>'target_value')::integer;
  comparison_op := coalesce(conditions->>'comparison_operator', 'gte');
  current_value := 0;

  CASE achievement_type
    WHEN 'threshold' THEN
      CASE achievement_record.category
        WHEN 'consumption' THEN
          IF achievement_record.name LIKE '%single day%' OR achievement_record.name LIKE '%Daily%' OR achievement_record.name LIKE '%Power%' OR achievement_record.name LIKE '%Session%' THEN
            SELECT COALESCE(MAX(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          ELSIF achievement_record.name LIKE '%across all festivals%' OR achievement_record.name LIKE '%Legend Status%' THEN
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSE
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;

        WHEN 'attendance' THEN
          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'social' THEN
          IF achievement_record.name LIKE '%group%' OR achievement_record.name LIKE '%Group%' THEN
            IF achievement_record.name LIKE '%Leader%' OR achievement_record.name LIKE '%Create%' THEN
              SELECT COUNT(*) INTO current_value
              FROM groups
              WHERE created_by = p_user_id AND festival_id = p_festival_id;
            ELSE
              SELECT COUNT(DISTINCT g.id) INTO current_value
              FROM group_members gm
              JOIN groups g ON gm.group_id = g.id
              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
            END IF;
          ELSIF achievement_record.name LIKE '%Photo%' THEN
            SELECT COUNT(*) INTO current_value
            FROM beer_pictures bp
            JOIN attendances a ON bp.attendance_id = a.id
            WHERE bp.user_id = p_user_id AND a.festival_id = p_festival_id;
          END IF;

        WHEN 'explorer' THEN
          SELECT COUNT(DISTINCT tent_id) INTO current_value
          FROM tent_visits
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'competitive' THEN
          SELECT COUNT(*) INTO current_value
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;

        WHEN 'special' THEN
          CASE achievement_record.name
            WHEN 'Festival Veteran' THEN
              SELECT COUNT(DISTINCT festival_id) INTO current_value
              FROM attendances
              WHERE user_id = p_user_id;

            WHEN 'High Roller' THEN
              -- Use festival beer_cost via helper function
              SELECT COALESCE(SUM(beer_count * get_festival_beer_cost(p_festival_id)), 0)::integer
              INTO current_value
              FROM attendances
              WHERE user_id = p_user_id AND festival_id = p_festival_id;

            ELSE
              RETURN false;
          END CASE;
      END CASE;

    WHEN 'variety' THEN
      SELECT COUNT(DISTINCT tent_id) INTO current_value
      FROM tent_visits
      WHERE user_id = p_user_id AND festival_id = p_festival_id;

    WHEN 'streak' THEN
      v_min_days := (conditions->>'min_days')::integer;
      v_max_streak := 0;
      v_current_streak := 0;
      v_prev_date := null;

      FOR v_attendance_date IN
        SELECT DISTINCT date::date
        FROM attendances
        WHERE user_id = p_user_id AND festival_id = p_festival_id
        ORDER BY date::date
      LOOP
        IF v_prev_date IS NULL OR v_attendance_date = v_prev_date + INTERVAL '1 day' THEN
          v_current_streak := v_current_streak + 1;
          v_max_streak := GREATEST(v_max_streak, v_current_streak);
        ELSE
          v_current_streak := 1;
        END IF;
        v_prev_date := v_attendance_date;
      END LOOP;

      current_value := v_max_streak;
      target_value := v_min_days;

    WHEN 'special' THEN
      CASE achievement_record.name
        WHEN 'Festival Warrior' THEN
          SELECT (end_date::date - start_date::date + 1) INTO v_festival_days
          FROM festivals WHERE id = p_festival_id;

          SELECT COUNT(DISTINCT date) INTO v_days_attended
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

          RETURN v_days_attended >= COALESCE(v_festival_days, 16);

        WHEN 'Early Bird' THEN
          SELECT start_date::date INTO v_festival_start
          FROM festivals WHERE id = p_festival_id;

          RETURN EXISTS(
            SELECT 1 FROM attendances
            WHERE user_id = p_user_id
            AND festival_id = p_festival_id
            AND date::date = v_festival_start
          );

        WHEN 'Night Owl' THEN
          SELECT end_date::date INTO v_festival_end
          FROM festivals WHERE id = p_festival_id;

          RETURN EXISTS(
            SELECT 1 FROM attendances
            WHERE user_id = p_user_id
            AND festival_id = p_festival_id
            AND date::date = v_festival_end
          );

        ELSE
          RETURN false;
      END CASE;

    ELSE
      RETURN false;
  END CASE;

  CASE comparison_op
    WHEN 'gte' THEN
      RETURN current_value >= target_value;
    WHEN 'eq' THEN
      RETURN current_value = target_value;
    WHEN 'gt' THEN
      RETURN current_value > target_value;
    ELSE
      RETURN current_value >= target_value;
  END CASE;
END;
$$;


ALTER FUNCTION public.calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: calculate_attendance_cost(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_attendance_cost(p_attendance_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_beer_count INTEGER;
  v_festival_id UUID;
  v_attendance_date DATE;
  v_user_id UUID;
BEGIN
  -- Get attendance details
  SELECT beer_count, festival_id, date, user_id
  INTO v_beer_count, v_festival_id, v_attendance_date, v_user_id
  FROM attendances 
  WHERE id = p_attendance_id;
  
  -- If user visited tents, calculate cost based on tent visits and their specific pricing
  -- Use average price if multiple tents visited
  SELECT COALESCE(AVG(ftp.beer_price), 0) * v_beer_count
  INTO v_total_cost
  FROM tent_visits tv
  JOIN festival_tent_pricing ftp ON tv.tent_id = ftp.tent_id 
    AND tv.festival_id = ftp.festival_id
    AND (ftp.price_start_date IS NULL OR ftp.price_start_date <= v_attendance_date)
    AND (ftp.price_end_date IS NULL OR ftp.price_end_date >= v_attendance_date)
  WHERE tv.user_id = v_user_id
    AND tv.festival_id = v_festival_id
    AND tv.visit_date::date = v_attendance_date;
    
  -- Fallback: if no tent visits recorded, use festival average price
  IF v_total_cost = 0 THEN
    SELECT COALESCE(AVG(ftp.beer_price), 16.2) * v_beer_count
    INTO v_total_cost
    FROM festival_tent_pricing ftp
    WHERE ftp.festival_id = v_festival_id
      AND (ftp.price_start_date IS NULL OR ftp.price_start_date <= v_attendance_date)
      AND (ftp.price_end_date IS NULL OR ftp.price_end_date >= v_attendance_date);
  END IF;
  
  RETURN v_total_cost;
END;
$$;


ALTER FUNCTION public.calculate_attendance_cost(p_attendance_id uuid) OWNER TO postgres;

--
-- Name: check_achievement_conditions(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  achievement_record achievements;
  conditions jsonb;
  achievement_type text;
  target_value integer;
  current_value integer;
  comparison_op text;
  -- Variables for streak calculation
  v_min_days integer;
  v_max_streak integer;
  v_current_streak integer;
  v_prev_date date;
  v_attendance_date date;
  -- Variables for special achievements
  v_festival_days integer;
  v_days_attended integer;
  v_weekend_days integer;
  v_weekend_attended integer;
BEGIN
  SELECT * INTO achievement_record
  FROM achievements
  WHERE id = p_achievement_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  conditions := achievement_record.conditions;
  achievement_type := conditions->>'type';
  target_value := (conditions->>'target_value')::integer;
  comparison_op := coalesce(conditions->>'comparison_operator', 'gte');
  current_value := 0;

  CASE achievement_type
    WHEN 'threshold' THEN
      CASE achievement_record.category
        WHEN 'consumption' THEN
          IF achievement_record.name LIKE '%single day%' OR achievement_record.name LIKE '%Daily%' OR achievement_record.name LIKE '%Power%' OR achievement_record.name LIKE '%Session%' THEN
            SELECT COALESCE(MAX(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          ELSIF achievement_record.name LIKE '%across all festivals%' OR achievement_record.name LIKE '%Legend Status%' THEN
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSE
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;

        WHEN 'attendance' THEN
          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'social' THEN
          IF achievement_record.name LIKE '%group%' OR achievement_record.name LIKE '%Group%' THEN
            IF achievement_record.name LIKE '%Leader%' OR achievement_record.name LIKE '%Create%' THEN
              SELECT COUNT(*) INTO current_value
              FROM groups
              WHERE created_by = p_user_id AND festival_id = p_festival_id;
            ELSE
              SELECT COUNT(DISTINCT g.id) INTO current_value
              FROM group_members gm
              JOIN groups g ON gm.group_id = g.id
              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
            END IF;
          ELSIF achievement_record.name LIKE '%Photo%' THEN
            SELECT COUNT(*) INTO current_value
            FROM beer_pictures bp
            JOIN attendances a ON bp.attendance_id = a.id
            WHERE bp.user_id = p_user_id AND a.festival_id = p_festival_id;
          END IF;

        WHEN 'explorer' THEN
          SELECT COUNT(DISTINCT tent_id) INTO current_value
          FROM tent_visits
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'competitive' THEN
          SELECT COUNT(*) INTO current_value
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;

        WHEN 'special' THEN
          CASE achievement_record.name
            WHEN 'Festival Veteran' THEN
              SELECT COUNT(DISTINCT festival_id) INTO current_value
              FROM attendances
              WHERE user_id = p_user_id;

            WHEN 'High Roller' THEN
              -- Use festival beer_cost via helper function
              SELECT COALESCE(SUM(beer_count * get_festival_beer_cost(p_festival_id)), 0)::integer
              INTO current_value
              FROM attendances
              WHERE user_id = p_user_id AND festival_id = p_festival_id;

            ELSE
              RETURN false;
          END CASE;
      END CASE;

    WHEN 'variety' THEN
      SELECT COUNT(DISTINCT tent_id) INTO current_value
      FROM tent_visits
      WHERE user_id = p_user_id AND festival_id = p_festival_id;

    WHEN 'streak' THEN
      v_min_days := (conditions->>'min_days')::integer;
      v_max_streak := 0;
      v_current_streak := 0;
      v_prev_date := null;

      FOR v_attendance_date IN
        SELECT DISTINCT date::date
        FROM attendances
        WHERE user_id = p_user_id AND festival_id = p_festival_id
        ORDER BY date::date
      LOOP
        IF v_prev_date IS NULL OR v_attendance_date = v_prev_date + INTERVAL '1 day' THEN
          v_current_streak := v_current_streak + 1;
          v_max_streak := GREATEST(v_max_streak, v_current_streak);
        ELSE
          v_current_streak := 1;
        END IF;
        v_prev_date := v_attendance_date;
      END LOOP;

      current_value := v_max_streak;
      target_value := v_min_days;

    WHEN 'special' THEN
      CASE achievement_record.name
        WHEN 'Festival Warrior' THEN
          SELECT (end_date::date - start_date::date + 1) INTO v_festival_days
          FROM festivals WHERE id = p_festival_id;

          SELECT COUNT(DISTINCT date::date) INTO v_days_attended
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

          RETURN v_days_attended = v_festival_days;

        WHEN 'Weekend Warrior' THEN
          SELECT COUNT(*) INTO v_weekend_days
          FROM generate_series(
            (SELECT start_date::date FROM festivals WHERE id = p_festival_id),
            (SELECT end_date::date FROM festivals WHERE id = p_festival_id),
            '1 day'::interval
          ) AS festival_date
          WHERE EXTRACT(DOW FROM festival_date) IN (0, 6);

          SELECT COUNT(DISTINCT date::date) INTO v_weekend_attended
          FROM attendances a
          WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
          AND EXTRACT(DOW FROM a.date::date) IN (0, 6);

          RETURN v_weekend_attended = v_weekend_days;

        WHEN 'Early Bird' THEN
          RETURN EXISTS (
            SELECT 1 FROM attendances a
            JOIN festivals f ON a.festival_id = f.id
            WHERE a.user_id = p_user_id
            AND a.festival_id = p_festival_id
            AND a.date::date = f.start_date::date
          );

        ELSE
          RETURN false;
      END CASE;

    ELSE
      RETURN false;
  END CASE;

  CASE comparison_op
    WHEN 'gte' THEN
      RETURN current_value >= target_value;
    WHEN 'gt' THEN
      RETURN current_value > target_value;
    WHEN 'eq' THEN
      RETURN current_value = target_value;
    WHEN 'lte' THEN
      RETURN current_value <= target_value;
    WHEN 'lt' THEN
      RETURN current_value < target_value;
    ELSE
      RETURN current_value >= target_value;
  END CASE;
END;
$$;


ALTER FUNCTION public.check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: check_notification_rate_limit(uuid, text, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notification_rate_limit
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND group_id = p_group_id
      AND created_at > NOW() - (p_minutes_ago || ' minutes')::INTERVAL
  );
END;
$$;


ALTER FUNCTION public.check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer) OWNER TO postgres;

--
-- Name: cleanup_old_location_points(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_location_points() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM location_points
  WHERE recorded_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION public.cleanup_old_location_points() OWNER TO postgres;

--
-- Name: cleanup_old_rate_limit_records(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_rate_limit_records() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM notification_rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION public.cleanup_old_rate_limit_records() OWNER TO postgres;

--
-- Name: create_default_notification_preferences(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_notification_preferences (
    user_id,
    reminders_enabled,
    group_notifications_enabled,
    achievement_notifications_enabled
  )
  VALUES (
    NEW.id,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_notification_preferences() OWNER TO postgres;

--
-- Name: create_group_with_member(character varying, uuid, uuid, integer, uuid, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer DEFAULT 2, p_invite_token uuid DEFAULT NULL::uuid, p_password character varying DEFAULT NULL::character varying) RETURNS TABLE(group_id uuid, group_name character varying, invite_token uuid, winning_criteria_id integer, festival_id uuid, created_by uuid, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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
$$;


ALTER FUNCTION public.create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer, p_invite_token uuid, p_password character varying) OWNER TO postgres;

--
-- Name: delete_attendance(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_attendance(p_attendance_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Delete associated beer pictures
    DELETE FROM public.beer_pictures
    WHERE attendance_id = p_attendance_id;

    -- Delete associated tent visits
    DELETE FROM public.tent_visits
    WHERE user_id IN (SELECT user_id FROM public.attendances WHERE id = p_attendance_id)
      AND visit_date::date = (SELECT date FROM public.attendances WHERE id = p_attendance_id)::date;

    -- Delete the attendance entry
    DELETE FROM public.attendances
    WHERE id = p_attendance_id;
END;
$$;


ALTER FUNCTION public.delete_attendance(p_attendance_id uuid) OWNER TO postgres;

--
-- Name: evaluate_achievement_progress(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  achievement_record achievements;
  conditions jsonb;
  achievement_type text;
  target_value integer;
  current_value integer;
  comparison_op text;
  result jsonb;
  -- Variables for streak calculation
  v_min_days integer;
  v_max_streak integer;
  v_current_streak integer;
  v_prev_date date;
  v_attendance_date date;
  -- Variables for special achievements
  v_festival_days integer;
  v_festival_start date;
  v_festival_end date;
  v_attended boolean;
BEGIN
  SELECT * INTO achievement_record
  FROM achievements
  WHERE id = p_achievement_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN '{"current_value": 0, "target_value": 1, "percentage": 0}';
  END IF;

  conditions := achievement_record.conditions;
  achievement_type := conditions->>'type';
  target_value := (conditions->>'target_value')::integer;
  comparison_op := coalesce(conditions->>'comparison_operator', 'gte');
  current_value := 0;

  CASE achievement_type
    WHEN 'threshold' THEN
      CASE achievement_record.category
        WHEN 'consumption' THEN
          IF achievement_record.name LIKE '%single day%' OR achievement_record.name LIKE '%Daily%' OR achievement_record.name LIKE '%Power%' OR achievement_record.name LIKE '%Session%' THEN
            SELECT COALESCE(MAX(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          ELSIF achievement_record.name LIKE '%across all festivals%' OR achievement_record.name LIKE '%Legend Status%' THEN
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSE
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;

        WHEN 'attendance' THEN
          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'social' THEN
          IF achievement_record.name LIKE '%group%' OR achievement_record.name LIKE '%Group%' THEN
            IF achievement_record.name LIKE '%Leader%' OR achievement_record.name LIKE '%Create%' THEN
              SELECT COUNT(*) INTO current_value
              FROM groups
              WHERE created_by = p_user_id AND festival_id = p_festival_id;
            ELSE
              SELECT COUNT(DISTINCT g.id) INTO current_value
              FROM group_members gm
              JOIN groups g ON gm.group_id = g.id
              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
            END IF;
          ELSIF achievement_record.name LIKE '%Photo%' THEN
            SELECT COUNT(*) INTO current_value
            FROM beer_pictures bp
            JOIN attendances a ON bp.attendance_id = a.id
            WHERE bp.user_id = p_user_id AND a.festival_id = p_festival_id;
          END IF;

        WHEN 'explorer' THEN
          SELECT COUNT(DISTINCT tent_id) INTO current_value
          FROM tent_visits
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

        WHEN 'competitive' THEN
          SELECT COUNT(*) INTO current_value
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;

        WHEN 'special' THEN
          IF achievement_record.name = 'Festival Veteran' THEN
            SELECT COUNT(DISTINCT festival_id) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSIF achievement_record.name = 'High Roller' THEN
            -- Use festival beer_cost via helper function
            SELECT COALESCE(SUM(beer_count * get_festival_beer_cost(p_festival_id)), 0)::integer
            INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;
      END CASE;

    WHEN 'variety' THEN
      SELECT COUNT(DISTINCT tent_id) INTO current_value
      FROM tent_visits
      WHERE user_id = p_user_id AND festival_id = p_festival_id;

    WHEN 'streak' THEN
      v_min_days := (conditions->>'min_days')::integer;
      v_max_streak := 0;
      v_current_streak := 0;
      v_prev_date := null;

      FOR v_attendance_date IN
        SELECT DISTINCT date::date
        FROM attendances
        WHERE user_id = p_user_id AND festival_id = p_festival_id
        ORDER BY date::date
      LOOP
        IF v_prev_date IS NULL OR v_attendance_date = v_prev_date + INTERVAL '1 day' THEN
          v_current_streak := v_current_streak + 1;
          v_max_streak := GREATEST(v_max_streak, v_current_streak);
        ELSE
          v_current_streak := 1;
        END IF;
        v_prev_date := v_attendance_date;
      END LOOP;

      current_value := v_max_streak;
      target_value := v_min_days;

    WHEN 'special' THEN
      CASE achievement_record.name
        WHEN 'Festival Warrior' THEN
          SELECT (end_date::date - start_date::date + 1) INTO v_festival_days
          FROM festivals WHERE id = p_festival_id;

          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;

          target_value := COALESCE(v_festival_days, 16);

        WHEN 'Early Bird' THEN
          SELECT start_date::date INTO v_festival_start
          FROM festivals WHERE id = p_festival_id;

          SELECT EXISTS(
            SELECT 1 FROM attendances
            WHERE user_id = p_user_id
            AND festival_id = p_festival_id
            AND date::date = v_festival_start
          ) INTO v_attended;

          current_value := CASE WHEN v_attended THEN 1 ELSE 0 END;
          target_value := 1;

        WHEN 'Night Owl' THEN
          SELECT end_date::date INTO v_festival_end
          FROM festivals WHERE id = p_festival_id;

          SELECT EXISTS(
            SELECT 1 FROM attendances
            WHERE user_id = p_user_id
            AND festival_id = p_festival_id
            AND date::date = v_festival_end
          ) INTO v_attended;

          current_value := CASE WHEN v_attended THEN 1 ELSE 0 END;
          target_value := 1;

        ELSE
          current_value := 0;
          target_value := 1;
      END CASE;

    ELSE
      current_value := 0;
      target_value := COALESCE(target_value, 1);
  END CASE;

  result := jsonb_build_object(
    'current_value', COALESCE(current_value, 0),
    'target_value', COALESCE(target_value, 1),
    'percentage', LEAST(100, ROUND((COALESCE(current_value, 0)::numeric / GREATEST(COALESCE(target_value, 1), 1)::numeric) * 100))
  );

  RETURN result;
END;
$$;


ALTER FUNCTION public.evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: evaluate_user_achievements(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  achievement_rec achievements;
  unlocked boolean;
BEGIN
  -- Loop through all active achievements
  FOR achievement_rec IN
    SELECT * FROM achievements WHERE is_active = true
  LOOP
    -- Check if conditions are met and not already unlocked
    -- Fixed parameter order: (p_user_id, p_achievement_id, p_festival_id)
    IF check_achievement_conditions(p_user_id, achievement_rec.id, p_festival_id) THEN
      -- Try to unlock the achievement
      SELECT unlock_achievement(p_user_id, p_festival_id, achievement_rec.id) INTO unlocked;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION evaluate_user_achievements(p_user_id uuid, p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) IS 'Evaluates all achievements for a user and unlocks eligible ones';


--
-- Name: expire_old_location_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_old_location_sessions() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE location_sessions
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE is_active = TRUE
    AND expires_at <= NOW();
END;
$$;


ALTER FUNCTION public.expire_old_location_sessions() OWNER TO postgres;

--
-- Name: expire_old_locations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_old_locations() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE user_locations
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
END;
$$;


ALTER FUNCTION public.expire_old_locations() OWNER TO postgres;

--
-- Name: fetch_group_gallery(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fetch_group_gallery(p_group_id uuid, p_festival_id uuid DEFAULT NULL::uuid, p_viewing_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(date date, user_id uuid, username text, full_name text, picture_data jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.date::DATE,
    bp.user_id,
    p.username,
    p.full_name,
    jsonb_agg(
      jsonb_build_object(
        'id', bp.id,
        'url', bp.picture_url,
        'uploadedAt', bp.created_at,
        'visibility', bp.visibility
      ) ORDER BY bp.created_at DESC
    ) AS picture_data
  FROM
    beer_pictures bp
    INNER JOIN attendances a ON bp.attendance_id = a.id
    INNER JOIN profiles p ON bp.user_id = p.id
    INNER JOIN group_members gm ON bp.user_id = gm.user_id
    LEFT JOIN user_photo_global_settings upgs ON bp.user_id = upgs.user_id
    LEFT JOIN user_group_photo_settings ugps ON (bp.user_id = ugps.user_id AND ugps.group_id = p_group_id)
  WHERE
    gm.group_id = p_group_id
    AND (p_festival_id IS NULL OR a.festival_id = p_festival_id)
    -- Only show public photos or user's own photos
    AND (bp.visibility = 'public' OR bp.user_id = p_viewing_user_id)
    -- Respect global "hide from all groups" setting (unless viewing own photos)
    AND (COALESCE(upgs.hide_photos_from_all_groups, FALSE) = FALSE OR bp.user_id = p_viewing_user_id)
    -- Respect per-group "hide from this group" setting (unless viewing own photos)
    AND (COALESCE(ugps.hide_photos_from_group, FALSE) = FALSE OR bp.user_id = p_viewing_user_id)
  GROUP BY
    a.date, bp.user_id, p.username, p.full_name
  ORDER BY
    a.date ASC, bp.user_id;
END;
$$;


ALTER FUNCTION public.fetch_group_gallery(p_group_id uuid, p_festival_id uuid, p_viewing_user_id uuid) OWNER TO postgres;

--
-- Name: generate_group_token(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_group_token() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Generate a new UUID token
  NEW.invite_token := gen_random_uuid();
  -- Set the token expiration to 7 days from now
  NEW.token_expiration := NOW() + INTERVAL '7 days';
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_group_token() OWNER TO postgres;

--
-- Name: get_achievement_leaderboard(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_achievement_leaderboard(p_festival_id uuid) RETURNS TABLE(user_id uuid, username text, full_name text, avatar_url text, total_achievements bigint, total_points bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    COUNT(ua.id) as total_achievements,
    COALESCE(SUM(a.points), 0) as total_points
  FROM profiles p
  LEFT JOIN user_achievements ua ON ua.user_id = p.id AND ua.festival_id = p_festival_id
  LEFT JOIN achievements a ON a.id = ua.achievement_id
  WHERE EXISTS (
    -- Only include users who have at least one attendance in this festival
    SELECT 1 FROM attendances att 
    WHERE att.user_id = p.id AND att.festival_id = p_festival_id
  )
  GROUP BY p.id, p.username, p.full_name, p.avatar_url
  HAVING COUNT(ua.id) > 0 -- Only users with at least one achievement
  ORDER BY total_points DESC, total_achievements DESC, p.username;
END;
$$;


ALTER FUNCTION public.get_achievement_leaderboard(p_festival_id uuid) OWNER TO postgres;

--
-- Name: get_festival_beer_cost(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_festival_beer_cost(p_festival_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_cost numeric;
BEGIN
  SELECT beer_cost INTO v_cost
  FROM festivals
  WHERE id = p_festival_id;

  IF v_cost IS NULL THEN
    SELECT value::numeric INTO v_cost
    FROM system_settings
    WHERE key = 'default_beer_cost';
  END IF;

  RETURN COALESCE(v_cost, 16.2);
END;
$$;


ALTER FUNCTION public.get_festival_beer_cost(p_festival_id uuid) OWNER TO postgres;

--
-- Name: get_global_leaderboard(integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid DEFAULT NULL::uuid) RETURNS TABLE(user_id uuid, username text, full_name text, avatar_url text, days_attended bigint, total_beers bigint, avg_beers numeric, group_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            a.user_id AS a_user_id,
            COUNT(DISTINCT a.date)::BIGINT AS days_attended,
            COALESCE(SUM(a.beer_count), 0)::BIGINT AS total_beers,
            CASE 
                WHEN COUNT(DISTINCT a.date) > 0 THEN 
                    ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
                ELSE 0
            END AS avg_beers
        FROM attendances a
        WHERE (p_festival_id IS NULL OR a.festival_id = p_festival_id)
        GROUP BY a.user_id
    ),
    group_stats AS (
        SELECT 
            gm.user_id AS g_user_id,
            COUNT(DISTINCT gm.group_id)::BIGINT AS group_count
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        WHERE (p_festival_id IS NULL OR g.festival_id = p_festival_id)
        GROUP BY gm.user_id
    )
    SELECT 
        p.id AS user_id,
        p.username::TEXT AS username,
        p.full_name::TEXT AS full_name,
        p.avatar_url::TEXT AS avatar_url,
        COALESCE(ast.days_attended, 0) AS days_attended,
        COALESCE(ast.total_beers, 0) AS total_beers,
        COALESCE(ast.avg_beers, 0) AS avg_beers,
        COALESCE(gs.group_count, 0) AS group_count
    FROM profiles p
    LEFT JOIN attendance_stats ast ON p.id = ast.a_user_id
    LEFT JOIN group_stats gs ON p.id = gs.g_user_id
    WHERE 
        -- Only include users who have attendance data for the specified festival
        (p_festival_id IS NULL OR ast.a_user_id IS NOT NULL)
        AND (ast.days_attended > 0 OR ast.total_beers > 0)
    ORDER BY
        CASE 
            WHEN p_winning_criteria_id = 1 THEN COALESCE(ast.days_attended, 0)
            WHEN p_winning_criteria_id = 2 THEN COALESCE(ast.total_beers, 0) 
            WHEN p_winning_criteria_id = 3 THEN COALESCE(ast.avg_beers, 0)
            ELSE COALESCE(ast.total_beers, 0)
        END DESC;
END;
$$;


ALTER FUNCTION public.get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid) OWNER TO postgres;

--
-- Name: get_group_achievement_recipients(uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) RETURNS TABLE(user_id uuid, festival_id uuid, recipient_ids uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH user_groups AS (
    -- Get all groups that the users belong to for the specified festivals
    SELECT DISTINCT 
      gm.user_id,
      g.festival_id,
      g.id as group_id
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id = ANY(p_user_ids)
      AND g.festival_id = ANY(p_festival_ids)
  ),
  group_recipients AS (
    -- Get all other members in those groups (excluding the achiever)
    SELECT 
      ug.user_id,
      ug.festival_id,
      ARRAY_AGG(gm2.user_id) as recipient_ids
    FROM user_groups ug
    JOIN group_members gm2 ON gm2.group_id = ug.group_id
    WHERE gm2.user_id != ug.user_id
    GROUP BY ug.user_id, ug.festival_id
  )
  SELECT 
    gr.user_id,
    gr.festival_id,
    gr.recipient_ids
  FROM group_recipients gr
  WHERE array_length(gr.recipient_ids, 1) > 0;
END;
$$;


ALTER FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) OWNER TO postgres;

--
-- Name: FUNCTION get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) IS 'Returns group members who should be notified when a user achieves a rare/epic achievement. 
Eliminates N+1 query pattern by consolidating group membership lookups into a single database call.';


--
-- Name: get_group_leaderboard(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer) RETURNS TABLE(user_id uuid, username text, full_name text, avatar_url text, group_id uuid, group_name character varying, festival_id uuid, festival_name character varying, days_attended bigint, total_beers bigint, avg_beers numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS user_id,
        p.username::TEXT AS username,
        p.full_name::TEXT AS full_name,
        p.avatar_url::TEXT AS avatar_url,
        g.id AS group_id,
        g.name AS group_name,
        g.festival_id,
        f.name AS festival_name,
        COUNT(DISTINCT a.date)::BIGINT AS days_attended,
        COALESCE(SUM(a.beer_count), 0)::BIGINT AS total_beers,
        CASE 
            WHEN COUNT(DISTINCT a.date) > 0 THEN 
                ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
            ELSE 0
        END AS avg_beers
    FROM profiles p
    INNER JOIN group_members gm ON p.id = gm.user_id
    INNER JOIN groups g ON gm.group_id = g.id
    INNER JOIN festivals f ON g.festival_id = f.id
    LEFT JOIN attendances a ON p.id = a.user_id AND a.festival_id = g.festival_id
    WHERE gm.group_id = p_group_id
    GROUP BY p.id, p.username, p.full_name, p.avatar_url, g.id, g.name, g.festival_id, f.name
    ORDER BY
        CASE 
            WHEN p_winning_criteria_id = 1 THEN COUNT(DISTINCT a.date)
            WHEN p_winning_criteria_id = 2 THEN COALESCE(SUM(a.beer_count), 0)
            WHEN p_winning_criteria_id = 3 THEN 
                CASE 
                    WHEN COUNT(DISTINCT a.date) > 0 THEN 
                        COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC
                    ELSE 0
                END
            ELSE COALESCE(SUM(a.beer_count), 0)
        END DESC;
END;
$$;


ALTER FUNCTION public.get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer) OWNER TO postgres;

--
-- Name: get_nearby_group_members(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer DEFAULT 500) RETURNS TABLE(user_id uuid, username text, full_name text, avatar_url text, latitude numeric, longitude numeric, distance_meters numeric, last_updated timestamp with time zone, group_names text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_lat DECIMAL;
  user_lng DECIMAL;
BEGIN
  -- First check if the user has an active location
  SELECT ul.latitude, ul.longitude INTO user_lat, user_lng
  FROM user_locations ul
  WHERE ul.user_id = input_user_id
    AND ul.festival_id = input_festival_id
    AND ul.status = 'active'
    AND ul.expires_at > NOW()
  LIMIT 1;

  -- If user has no active location, return empty result
  IF user_lat IS NULL OR user_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ul.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    ul.latitude,
    ul.longitude,
    -- Haversine distance calculation (approximation)
    (6371000 * acos(
      cos(radians(user_lat)) *
      cos(radians(ul.latitude)) *
      cos(radians(ul.longitude) - radians(user_lng)) +
      sin(radians(user_lat)) *
      sin(radians(ul.latitude))
    )) as distance_meters,
    ul.last_updated,
    array_agg(DISTINCT g.name) as group_names
  FROM user_locations ul
  JOIN profiles p ON p.id = ul.user_id
  JOIN group_members gm ON gm.user_id = ul.user_id
  JOIN groups g ON g.id = gm.group_id AND g.festival_id = input_festival_id
  WHERE ul.festival_id = input_festival_id
    AND ul.status = 'active'
    AND ul.expires_at > NOW()
    AND ul.user_id != input_user_id
    AND EXISTS (
      -- Only include users who share groups and have enabled sharing
      SELECT 1
      FROM location_sharing_preferences lsp
      JOIN group_members gm1 ON gm1.group_id = lsp.group_id AND gm1.user_id = lsp.user_id
      JOIN group_members gm2 ON gm2.group_id = lsp.group_id AND gm2.user_id = input_user_id
      WHERE lsp.user_id = ul.user_id
        AND lsp.festival_id = input_festival_id
        AND lsp.sharing_enabled = true
    )
    AND (6371000 * acos(
      cos(radians(user_lat)) *
      cos(radians(ul.latitude)) *
      cos(radians(ul.longitude) - radians(user_lng)) +
      sin(radians(user_lat)) *
      sin(radians(ul.latitude))
    )) <= radius_meters
  GROUP BY ul.user_id, p.username, p.full_name, p.avatar_url,
           ul.latitude, ul.longitude, ul.last_updated
  ORDER BY distance_meters ASC;
END;
$$;


ALTER FUNCTION public.get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer) OWNER TO postgres;

--
-- Name: get_user_achievements(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) RETURNS TABLE(achievement_id uuid, name text, description text, category public.achievement_category_enum, icon text, points integer, rarity public.achievement_rarity_enum, is_unlocked boolean, unlocked_at timestamp with time zone, current_progress jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.category,
    a.icon,
    a.points,
    a.rarity,
    ua.id IS NOT NULL as is_unlocked,
    ua.unlocked_at,
    evaluate_achievement_progress(p_user_id, a.id, p_festival_id) as current_progress
  FROM achievements a
  LEFT JOIN user_achievements ua ON (
    ua.achievement_id = a.id
    AND ua.user_id = p_user_id
    AND ua.festival_id = p_festival_id
  )
  WHERE a.is_active = true
  ORDER BY
    CASE WHEN ua.id IS NOT NULL THEN 0 ELSE 1 END, -- Unlocked first
    a.category,
    a.points,
    a.name;
END;
$$;


ALTER FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_achievements(p_user_id uuid, p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) IS 'Returns all achievements with progress data for a user in a specific festival';


--
-- Name: get_user_all_group_photo_settings(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_all_group_photo_settings(p_user_id uuid) RETURNS TABLE(group_id uuid, group_name text, hide_photos_from_group boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as group_id,
        g.name::TEXT as group_name,
        COALESCE(ugps.hide_photos_from_group, FALSE) as hide_photos_from_group
    FROM groups g
    INNER JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN user_group_photo_settings ugps ON (g.id = ugps.group_id AND ugps.user_id = p_user_id)
    WHERE gm.user_id = p_user_id
    ORDER BY g.name;
END;
$$;


ALTER FUNCTION public.get_user_all_group_photo_settings(p_user_id uuid) OWNER TO postgres;

--
-- Name: get_user_festival_stats(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_festival_stats(p_user_id uuid, p_festival_id uuid) RETURNS TABLE(total_beers bigint, days_attended bigint, avg_beers numeric, total_spent numeric, favorite_tent character varying, most_expensive_day numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(a.beer_count), 0) as total_beers,
    COUNT(DISTINCT a.date) as days_attended,
    COALESCE(AVG(a.beer_count), 0) as avg_beers,
    COALESCE(SUM(calculate_attendance_cost(a.id)), 0) as total_spent,
    -- Most visited tent
    (SELECT t.name 
     FROM tent_visits tv 
     JOIN tents t ON tv.tent_id = t.id 
     WHERE tv.user_id = p_user_id AND tv.festival_id = p_festival_id
     GROUP BY t.id, t.name 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as favorite_tent,
    -- Most expensive single day
    MAX(calculate_attendance_cost(a.id)) as most_expensive_day
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id;
END;
$$;


ALTER FUNCTION public.get_user_festival_stats(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: get_user_festival_stats_with_positions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid) RETURNS TABLE(top_positions jsonb, total_beers bigint, days_attended bigint)
    LANGUAGE plpgsql
    AS $$
DECLARE
  user_total_beers BIGINT := 0;
  user_days_attended BIGINT := 0;
BEGIN
  -- Get user's total beers and days attended for the festival
  SELECT 
    COALESCE(SUM(a.beer_count), 0),
    COUNT(DISTINCT a.date)
  INTO 
    user_total_beers,
    user_days_attended
  FROM 
    attendances a
  WHERE 
    a.user_id = p_user_id
    AND a.festival_id = p_festival_id;

  -- Return the stats with top positions
  RETURN QUERY
  WITH ranked_leaderboard AS (
    SELECT 
      g.id AS group_id,
      g.name AS group_name,
      wc.name AS winning_criteria,
      CASE 
        WHEN wc.name = 'days_attended' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COUNT(DISTINCT a.date) DESC, p.username ASC
          )
        WHEN wc.name = 'total_beers' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COALESCE(SUM(a.beer_count), 0) DESC, p.username ASC
          )
        WHEN wc.name = 'avg_beers' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COALESCE(AVG(a.beer_count), 0) DESC, p.username ASC
          )
        ELSE 1
      END AS user_rank
    FROM 
      groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN attendances a ON gm.user_id = a.user_id AND a.festival_id = p_festival_id
      LEFT JOIN profiles p ON gm.user_id = p.id
      LEFT JOIN winning_criteria wc ON g.winning_criteria_id = wc.id
    WHERE 
      g.festival_id = p_festival_id
      AND gm.user_id = p_user_id  -- Only consider groups where the user is a member
    GROUP BY 
      g.id, g.name, wc.name, p.username  -- Include p.username in GROUP BY
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'group_id', group_id, 
          'group_name', group_name
        )
      ) FILTER (WHERE user_rank <= 3), 
      '[]'::jsonb
    ) AS top_positions,
    user_total_beers AS total_beers,
    user_days_attended AS days_attended
  FROM 
    ranked_leaderboard
  WHERE 
    user_rank <= 3;

  -- If no groups found, still return the user's stats
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      '[]'::jsonb AS top_positions,
      user_total_beers AS total_beers,
      user_days_attended AS days_attended;
  END IF;

END;
$$;


ALTER FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: get_user_group_photo_settings(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_group_photo_settings(p_user_id uuid, p_group_id uuid) RETURNS TABLE(user_id uuid, group_id uuid, hide_photos_from_group boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Insert default settings if they don't exist
    INSERT INTO user_group_photo_settings (user_id, group_id, hide_photos_from_group)
    VALUES (p_user_id, p_group_id, FALSE)
    ON CONFLICT ON CONSTRAINT user_group_photo_settings_user_id_group_id_key DO NOTHING;
    
    -- Return the settings
    RETURN QUERY
    SELECT ugps.user_id, ugps.group_id, ugps.hide_photos_from_group
    FROM user_group_photo_settings ugps
    WHERE ugps.user_id = p_user_id AND ugps.group_id = p_group_id;
END;
$$;


ALTER FUNCTION public.get_user_group_photo_settings(p_user_id uuid, p_group_id uuid) OWNER TO postgres;

--
-- Name: get_user_groups(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_groups() RETURNS SETOF uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT group_id FROM group_members
  WHERE user_id = auth.uid();
END;
$$;


ALTER FUNCTION public.get_user_groups() OWNER TO postgres;

--
-- Name: get_user_photo_global_settings(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_photo_global_settings(p_user_id uuid) RETURNS TABLE(user_id uuid, hide_photos_from_all_groups boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Insert default settings if they don't exist
    INSERT INTO user_photo_global_settings (user_id, hide_photos_from_all_groups)
    VALUES (p_user_id, FALSE)
    ON CONFLICT ON CONSTRAINT user_photo_global_settings_user_id_key DO NOTHING;
    
    -- Return the settings
    RETURN QUERY
    SELECT upgs.user_id, upgs.hide_photos_from_all_groups
    FROM user_photo_global_settings upgs
    WHERE upgs.user_id = p_user_id;
END;
$$;


ALTER FUNCTION public.get_user_photo_global_settings(p_user_id uuid) OWNER TO postgres;

--
-- Name: get_user_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_stats(input_user_id uuid) RETURNS TABLE(top_positions jsonb, total_beers bigint, days_attended bigint)
    LANGUAGE plpgsql
    AS $$
DECLARE
    user_total_beers bigint := 0;  -- Initialize to 0
    user_days_attended bigint := 0;  -- Initialize to 0
BEGIN
    -- Get total beers and days attended for the user
    SELECT 
        COALESCE(SUM(beer_count), 0),
        COALESCE(COUNT(DISTINCT date), 0)
    INTO user_total_beers, user_days_attended
    FROM 
        attendances
    WHERE 
        user_id = input_user_id;

    -- Get top positions from the leaderboard view, ordered by winning_criteria
    RETURN QUERY
    WITH ranked_leaderboard AS (
        SELECT 
            g.id AS group_id,
            g.name AS group_name,
            ROW_NUMBER() OVER (PARTITION BY g.id ORDER BY 
                CASE 
                    WHEN wc.name = 'total_beers' THEN SUM(a.beer_count)
                    WHEN wc.name = 'days_attended' THEN COUNT(DISTINCT a.date)
                    WHEN wc.name = 'avg_beers' THEN 
                        COALESCE(SUM(a.beer_count) / NULLIF(COUNT(DISTINCT a.date), 0), 0)  -- Calculate avg_beers
                    ELSE 0  -- Default case
                END DESC
            ) AS user_position
        FROM 
            groups g
        JOIN 
            winning_criteria wc ON g.winning_criteria_id = wc.id  -- Join with winning_criteria
        JOIN 
            group_members gm ON g.id = gm.group_id
        LEFT JOIN 
            attendances a ON a.user_id = input_user_id
        WHERE 
            gm.user_id = input_user_id  -- Ensure we only consider groups where the user is a member
        GROUP BY 
            g.id, g.name, wc.name  -- Include wc.name in GROUP BY
    )
    SELECT 
        jsonb_agg(jsonb_build_object('group_id', group_id, 'group_name', group_name)) AS top_positions,
        user_total_beers AS total_beers,
        user_days_attended AS days_attended
    FROM 
        ranked_leaderboard
    WHERE 
        user_position <= 3;  -- Only include top 3 positions
END;
$$;


ALTER FUNCTION public.get_user_stats(input_user_id uuid) OWNER TO postgres;

--
-- Name: get_wrapped_data(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_festival RECORD;
  v_user RECORD;
  v_basic_stats JSONB;
  v_tent_stats JSONB;
  v_peak_moments JSONB;
  v_social_stats JSONB;
  v_global_positions JSONB;
  v_achievements JSONB;
  v_timeline JSONB;
  v_comparisons JSONB;
  v_personality JSONB;
  v_beer_cost DECIMAL(5,2);
BEGIN
  -- Get festival info
  SELECT * INTO v_festival FROM festivals WHERE id = p_festival_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Festival not found';
  END IF;

  -- Get user profile
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get default beer cost from festival or use global default
  v_beer_cost := COALESCE(v_festival.beer_cost, 16.20);

  -- Build user_info
  v_result := jsonb_build_object(
    'user_info', jsonb_build_object(
      'username', v_user.username,
      'full_name', v_user.full_name,
      'avatar_url', v_user.avatar_url
    ),
    'festival_info', jsonb_build_object(
      'name', v_festival.name,
      'start_date', v_festival.start_date,
      'end_date', v_festival.end_date,
      'location', v_festival.location
    )
  );

  -- Calculate basic stats
  -- Using festival beer cost for simplified calculation (fallback: festival -> global default)
  WITH attendance_agg AS (
    SELECT
      COUNT(DISTINCT a.date) AS days_attended,
      COALESCE(SUM(a.beer_count), 0) AS total_beers,
      CASE
        WHEN COUNT(DISTINCT a.date) > 0 THEN
          ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
        ELSE 0
      END AS avg_beers
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  )
  SELECT jsonb_build_object(
    'total_beers', total_beers,
    'days_attended', days_attended,
    'avg_beers', avg_beers,
    'total_spent', ROUND(total_beers * v_beer_cost, 2),
    'beer_cost', v_beer_cost
  ) INTO v_basic_stats
  FROM attendance_agg;

  v_result := v_result || jsonb_build_object('basic_stats', v_basic_stats);

  -- Calculate tent stats (FIXED VERSION - added festival_id filter)
  WITH tent_stats AS (
    SELECT
      tv.tent_id,
      t.name as tent_name,
      COUNT(*) AS visit_count
    FROM tent_visits tv
    JOIN tents t ON tv.tent_id = t.id
    WHERE tv.user_id = p_user_id
      AND tv.festival_id = p_festival_id
    GROUP BY tv.tent_id, t.name
  ),
  tent_agg AS (
    SELECT
      COUNT(DISTINCT tent_id) AS unique_tents,
      (
        SELECT tent_name
        FROM tent_stats ts
        ORDER BY ts.visit_count DESC, ts.tent_name ASC
        LIMIT 1
      ) AS favorite_tent,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'tent_name', tent_name,
            'visit_count', visit_count
          ) ORDER BY visit_count DESC, tent_name ASC
        )
        FROM tent_stats ts
      ) AS tent_breakdown
    FROM tent_stats
  ),
  tent_total AS (
    SELECT COUNT(*) AS total_tents FROM tents
  )
  SELECT jsonb_build_object(
    'unique_tents', COALESCE(ta.unique_tents, 0),
    'favorite_tent', ta.favorite_tent,
    'tent_diversity_pct', CASE
      WHEN tt.total_tents > 0 THEN ROUND((COALESCE(ta.unique_tents, 0)::NUMERIC / tt.total_tents::NUMERIC) * 100, 1)
      ELSE 0
    END,
    'tent_breakdown', COALESCE(ta.tent_breakdown, '[]'::JSONB)
  ) INTO v_tent_stats
  FROM tent_agg ta, tent_total tt;

  v_result := v_result || jsonb_build_object('tent_stats', v_tent_stats);

  -- Calculate peak moments
  -- Best day now uses combined score (beers + tents_visited) for more comprehensive performance metric
  WITH daily_scores AS (
    SELECT
      a.date,
      a.beer_count,
      COALESCE(tv.tent_count, 0) as tents_visited,
      (a.beer_count + COALESCE(tv.tent_count, 0)) as combined_score,
      ROUND(a.beer_count * v_beer_cost, 2) AS spent
    FROM attendances a
    LEFT JOIN (
      SELECT
        tv.visit_date::date as date,
        COUNT(DISTINCT tv.tent_id) as tent_count
      FROM tent_visits tv
      WHERE tv.user_id = p_user_id
        AND tv.festival_id = p_festival_id
      GROUP BY tv.visit_date::date
    ) tv ON a.date = tv.date
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  best_day AS (
    SELECT
      ds.date,
      ds.beer_count,
      ds.tents_visited,
      ds.spent
    FROM daily_scores ds
    ORDER BY ds.combined_score DESC, ds.date DESC
    LIMIT 1
  ),
  max_session AS (
    SELECT COALESCE(MAX(a.beer_count), 0) AS max_beers
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  most_expensive AS (
    SELECT
      a.date,
      ROUND(a.beer_count * v_beer_cost, 2) AS amount
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
    ORDER BY (a.beer_count * v_beer_cost) DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'best_day', CASE
      WHEN bd.date IS NOT NULL THEN
        jsonb_build_object(
          'date', bd.date,
          'beer_count', bd.beer_count,
          'tents_visited', bd.tents_visited,
          'spent', bd.spent
        )
      ELSE NULL
    END,
    'max_single_session', ms.max_beers,
    'most_expensive_day', CASE
      WHEN me.date IS NOT NULL THEN
        jsonb_build_object(
          'date', me.date,
          'amount', me.amount
        )
      ELSE NULL
    END
  ) INTO v_peak_moments
  FROM best_day bd, max_session ms, most_expensive me;

  v_result := v_result || jsonb_build_object('peak_moments', v_peak_moments);

  -- Calculate social stats
  WITH user_groups AS (
    SELECT
      COUNT(DISTINCT gm.group_id) AS groups_joined,
      COUNT(DISTINCT gm2.user_id) AS total_group_members
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    LEFT JOIN group_members gm2 ON g.id = gm2.group_id AND gm2.user_id != p_user_id
    WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id
  ),
  top_rankings AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'group_name', group_name,
        'position', user_rank
      ) ORDER BY user_rank ASC
    ) AS rankings
    FROM (
      SELECT
        g.name AS group_name,
        wc.name AS winning_criteria,
        CASE
          WHEN wc.name = 'days_attended' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COUNT(DISTINCT a.date) DESC, p.username ASC
            )
          WHEN wc.name = 'total_beers' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COALESCE(SUM(a.beer_count), 0) DESC, p.username ASC
            )
          WHEN wc.name = 'avg_beers' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COALESCE(AVG(a.beer_count), 0) DESC, p.username ASC
            )
          ELSE 1
        END AS user_rank
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN attendances a ON gm.user_id = a.user_id AND a.festival_id = p_festival_id
      LEFT JOIN profiles p ON gm.user_id = p.id
      LEFT JOIN winning_criteria wc ON g.winning_criteria_id = wc.id
      WHERE g.festival_id = p_festival_id AND gm.user_id = p_user_id
      GROUP BY g.id, g.name, wc.name, p.username
    ) ranked
    WHERE user_rank <= 3
  ),
  photo_count AS (
    SELECT COUNT(*) AS photos_uploaded
    FROM beer_pictures bp
    JOIN attendances a ON bp.attendance_id = a.id
    WHERE bp.user_id = p_user_id
      AND a.date >= v_festival.start_date
      AND a.date <= v_festival.end_date
      AND a.festival_id = p_festival_id
  ),
  user_pictures AS (
    SELECT
      bp.id,
      bp.picture_url,
      bp.created_at,
      a.date as attendance_date
    FROM beer_pictures bp
    JOIN attendances a ON bp.attendance_id = a.id
    WHERE bp.user_id = p_user_id
      AND a.date >= v_festival.start_date
      AND a.date <= v_festival.end_date
      AND a.festival_id = p_festival_id
    ORDER BY bp.created_at DESC
    LIMIT 20 -- Limit to prevent excessive data
  )
  SELECT jsonb_build_object(
    'groups_joined', ug.groups_joined,
    'top_3_rankings', COALESCE(tr.rankings, '[]'::JSONB),
    'photos_uploaded', pc.photos_uploaded,
    'total_group_members', ug.total_group_members,
    'pictures', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', up.id,
          'picture_url', up.picture_url,
          'created_at', up.created_at,
          'attendance_date', up.attendance_date
        )
      ) FROM user_pictures up),
      '[]'::JSONB
    )
  ) INTO v_social_stats
  FROM user_groups ug, top_rankings tr, photo_count pc;

  v_result := v_result || jsonb_build_object('social_stats', v_social_stats);

  -- Calculate global leaderboard positions for days_attended, total_beers, and avg_beers
  WITH global_positions AS (
    SELECT
      'days_attended' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.days_attended DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.days_attended DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(1, p_festival_id) gl
    UNION ALL
    SELECT
      'total_beers' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.total_beers DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.total_beers DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(2, p_festival_id) gl
    UNION ALL
    SELECT
      'avg_beers' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.avg_beers DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.avg_beers DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(3, p_festival_id) gl
  )
  SELECT jsonb_build_object(
    'days_attended', MAX(CASE WHEN criteria = 'days_attended' THEN position END),
    'total_beers', MAX(CASE WHEN criteria = 'total_beers' THEN position END),
    'avg_beers', MAX(CASE WHEN criteria = 'avg_beers' THEN position END)
  ) INTO v_global_positions
  FROM global_positions;

  v_result := v_result || jsonb_build_object('global_leaderboard_positions', v_global_positions);

  -- Get achievements
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'icon', a.icon,
        'points', a.points,
        'rarity', a.rarity,
        'unlocked_at', ua.unlocked_at
      ) ORDER BY ua.unlocked_at DESC
    ),
    '[]'::JSONB
  ) INTO v_achievements
  FROM user_achievements ua
  JOIN achievements a ON ua.achievement_id = a.id
  WHERE ua.user_id = p_user_id AND ua.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('achievements', v_achievements);

  -- Build timeline (daily progression)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', a.date,
        'beer_count', a.beer_count,
        'spent', ROUND(a.beer_count * v_beer_cost, 2),
        'tents_visited', (
          SELECT COUNT(DISTINCT tent_id)
          FROM tent_visits tv
          WHERE tv.user_id = p_user_id 
            AND tv.festival_id = p_festival_id
            AND tv.visit_date::date = a.date
        )
      ) ORDER BY a.date ASC
    ),
    '[]'::JSONB
  ) INTO v_timeline
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('timeline', v_timeline);

  -- Calculate comparisons
  WITH festival_avg AS (
    SELECT
      ROUND(AVG(total_beers), 2) AS avg_beers,
      ROUND(AVG(days_attended), 2) AS avg_days
    FROM (
      SELECT
        user_id,
        COUNT(DISTINCT date) AS days_attended,
        SUM(beer_count) AS total_beers
      FROM attendances
      WHERE festival_id = p_festival_id
      GROUP BY user_id
    ) user_stats
  ),
  user_current AS (
    SELECT
      (v_basic_stats->>'total_beers')::NUMERIC AS user_beers,
      (v_basic_stats->>'days_attended')::NUMERIC AS user_days
  ),
  previous_festival AS (
    SELECT
      f.id as festival_id,
      f.name as festival_name,
      COUNT(DISTINCT a.date) AS prev_days,
      COALESCE(SUM(a.beer_count), 0) AS prev_beers,
      COALESCE(SUM(a.beer_count) * v_beer_cost, 0) AS prev_spent
    FROM attendances a
    JOIN festivals f ON a.festival_id = f.id
    WHERE a.user_id = p_user_id
      AND f.festival_type = v_festival.festival_type
      AND f.start_date < v_festival.start_date
      AND f.id != p_festival_id
    GROUP BY f.id, f.name, f.start_date
    ORDER BY f.start_date DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'vs_festival_avg', jsonb_build_object(
      'beers_diff_pct', CASE
        WHEN fa.avg_beers > 0 THEN ROUND(((uc.user_beers - fa.avg_beers) / fa.avg_beers) * 100, 1)
        ELSE 0
      END,
      'days_diff_pct', CASE
        WHEN fa.avg_days > 0 THEN ROUND(((uc.user_days - fa.avg_days) / fa.avg_days) * 100, 1)
        ELSE 0
      END,
      'avg_beers', fa.avg_beers,
      'avg_days', fa.avg_days
    ),
    'vs_last_year', CASE
      WHEN pf.prev_beers > 0 THEN
        jsonb_build_object(
          'beers_diff', uc.user_beers - pf.prev_beers,
          'days_diff', uc.user_days - pf.prev_days,
          'spent_diff', ROUND((uc.user_beers * v_beer_cost) - pf.prev_spent, 2),
          'prev_beers', pf.prev_beers,
          'prev_days', pf.prev_days,
          'prev_festival_name', pf.festival_name
        )
      ELSE NULL
    END
  ) INTO v_comparisons
  FROM festival_avg fa, user_current uc, previous_festival pf;

  v_result := v_result || jsonb_build_object('comparisons', v_comparisons);

  -- Calculate personality type
  WITH user_patterns AS (
    SELECT
      (v_basic_stats->>'total_beers')::INT AS total_beers,
      (v_basic_stats->>'days_attended')::INT AS days_attended,
      (v_basic_stats->>'avg_beers')::NUMERIC AS avg_beers,
      (v_tent_stats->>'unique_tents')::INT AS unique_tents,
      (SELECT COUNT(*) FROM tents) AS total_tents,
      -- Check if early bird (attended first day)
      EXISTS (
        SELECT 1 FROM attendances
        WHERE user_id = p_user_id
          AND festival_id = p_festival_id
          AND date = v_festival.start_date
      ) AS attended_first_day,
      -- Check consistency (variance in daily beers)
      COALESCE(STDDEV(beer_count), 0) AS beer_variance
    FROM attendances
    WHERE user_id = p_user_id AND festival_id = p_festival_id
  )
  SELECT jsonb_build_object(
    'type', CASE
      -- Determine primary personality type
      WHEN up.unique_tents >= up.total_tents * 0.7 THEN 'Explorer'
      WHEN up.avg_beers >= 8 THEN 'Champion'
      WHEN up.days_attended >= (v_festival.end_date - v_festival.start_date + 1) * 0.8 THEN 'Loyalist'
      WHEN up.avg_beers <= 3 AND up.days_attended >= 5 THEN 'Social Butterfly'
      WHEN up.beer_variance < 2 THEN 'Consistent'
      ELSE 'Casual Enjoyer'
    END,
    'traits', jsonb_build_array(
      CASE WHEN up.attended_first_day THEN 'Early Bird' END,
      CASE WHEN up.beer_variance < 2 THEN 'Steady Pace' ELSE 'Variable' END,
      CASE WHEN up.unique_tents >= up.total_tents * 0.5 THEN 'Tent Explorer' ELSE 'Tent Loyalist' END,
      CASE WHEN up.avg_beers >= 6 THEN 'Heavy Hitter'
           WHEN up.avg_beers >= 4 THEN 'Moderate'
           ELSE 'Light Drinker' END
    ) - ARRAY[NULL]::TEXT[] -- Remove nulls
  ) INTO v_personality
  FROM user_patterns up;

  v_result := v_result || jsonb_build_object('personality', v_personality);

  RETURN v_result;
END;
$$;


ALTER FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_wrapped_data(p_user_id uuid, p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) IS 'Returns comprehensive wrapped statistics for a user''s festival experience including basic stats, tent exploration, peak moments, social stats, achievements, timeline, comparisons, and personality insights.';


--
-- Name: get_wrapped_data_cached(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_cached_data JSONB;
  v_calculated_data JSONB;
BEGIN
  -- Try to get cached data first
  SELECT wrapped_data INTO v_cached_data
  FROM wrapped_data_cache
  WHERE user_id = p_user_id AND festival_id = p_festival_id;

  -- If cached data exists, return it
  IF v_cached_data IS NOT NULL THEN
    RETURN v_cached_data;
  END IF;

  -- Otherwise, calculate fresh data
  SELECT get_wrapped_data(p_user_id, p_festival_id) INTO v_calculated_data;

  -- If calculation returned data, cache it
  IF v_calculated_data IS NOT NULL THEN
    INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by)
    VALUES (p_user_id, p_festival_id, v_calculated_data, 'system')
    ON CONFLICT (user_id, festival_id)
    DO UPDATE SET
      wrapped_data = EXCLUDED.wrapped_data,
      generated_by = EXCLUDED.generated_by,
      updated_at = NOW();
  END IF;

  RETURN v_calculated_data;
END;
$$;


ALTER FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) IS 'Returns cached wrapped data if available, otherwise calculates and caches fresh data.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile without RLS checks (SECURITY DEFINER context)
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Re-raise the error
    RAISE;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: insert_achievement_event_from_unlock(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_achievement_event_from_unlock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_rarity achievement_rarity_enum;
BEGIN
  SELECT rarity INTO v_rarity FROM achievements WHERE id = NEW.achievement_id;
  INSERT INTO achievement_events (user_id, festival_id, achievement_id, rarity)
  VALUES (NEW.user_id, NEW.festival_id, NEW.achievement_id, v_rarity);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.insert_achievement_event_from_unlock() OWNER TO postgres;

--
-- Name: invalidate_festival_wrapped_cache(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invalidate_festival_wrapped_cache(p_festival_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM wrapped_data_cache WHERE festival_id = p_festival_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION public.invalidate_festival_wrapped_cache(p_festival_id uuid) OWNER TO postgres;

--
-- Name: invalidate_wrapped_cache(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Delete cache entries for the user (and specific festival if provided)
  IF p_festival_id IS NOT NULL THEN
    DELETE FROM wrapped_data_cache
    WHERE user_id = p_user_id AND festival_id = p_festival_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSE
    DELETE FROM wrapped_data_cache WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION public.invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid) OWNER TO postgres;

--
-- Name: is_group_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_group_member(group_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = $1
    AND group_members.user_id = $2
  );
END;
$_$;


ALTER FUNCTION public.is_group_member(group_id uuid, user_id uuid) OWNER TO postgres;

--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$;


ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

--
-- Name: join_group(uuid, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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
$$;


ALTER FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid) OWNER TO postgres;

--
-- Name: join_group_with_token(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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
$$;


ALTER FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid) OWNER TO postgres;

--
-- Name: record_notification_rate_limit(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO notification_rate_limit (user_id, group_id, notification_type, created_at)
  VALUES (p_user_id, p_group_id, p_notification_type, NOW());
END;
$$;


ALTER FUNCTION public.record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text) OWNER TO postgres;

--
-- Name: regenerate_wrapped_data_cache(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid DEFAULT NULL::uuid, p_festival_id uuid DEFAULT NULL::uuid, p_admin_user_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_regenerated_count INTEGER := 0;
  v_query TEXT;
BEGIN
  -- Verify admin permissions (you can customize this based on your admin system)
  IF p_admin_user_id IS NOT NULL THEN
    -- Check if user is super admin
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = p_admin_user_id
      AND is_super_admin = true
    ) THEN
      RAISE EXCEPTION 'Insufficient permissions to regenerate cache';
    END IF;
  END IF;

  -- Build dynamic query based on provided parameters
  v_query := '
    WITH calculated_data AS (
      SELECT
        wdc.user_id,
        wdc.festival_id,
        get_wrapped_data(wdc.user_id, wdc.festival_id) as new_data
      FROM wrapped_data_cache wdc
      WHERE 1=1';

  IF p_user_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.user_id = $1';
  END IF;

  IF p_festival_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.festival_id = $2';
  END IF;

  v_query := v_query || '
    )
    UPDATE wrapped_data_cache
    SET
      wrapped_data = calculated_data.new_data,
      generated_by = ''admin'',
      updated_at = NOW()
    FROM calculated_data
    WHERE wrapped_data_cache.user_id = calculated_data.user_id
      AND wrapped_data_cache.festival_id = calculated_data.festival_id
      AND calculated_data.new_data IS NOT NULL';

  -- Execute the query with appropriate parameters
  IF p_user_id IS NOT NULL AND p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id, p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_user_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSE
    EXECUTE v_query;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  END IF;

  RETURN v_regenerated_count;
END;
$_$;


ALTER FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid) IS 'Admin function to regenerate cached wrapped data for specific users/festivals.';


--
-- Name: renew_group_token(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.renew_group_token(p_group_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_token uuid;
BEGIN
  -- Generate a new UUID token
  new_token := gen_random_uuid();

  -- Update the group with the new token and set the expiration to 7 days from now
  UPDATE groups
  SET invite_token = new_token,
      token_expiration = NOW() + INTERVAL '7 days'
  WHERE id = p_group_id;

  RETURN new_token;
END;
$$;


ALTER FUNCTION public.renew_group_token(p_group_id uuid) OWNER TO postgres;

--
-- Name: rpc_due_reservation_prompts(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone) RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  JOIN festivals f ON f.id = r.festival_id
  WHERE r.status = 'scheduled'
    AND p.reminders_enabled = true
    AND r.prompt_sent_at IS NULL
    AND r.start_at <= p_now
    -- Skip if user already has attendance for the festival date
    AND NOT EXISTS (
      SELECT 1 FROM attendances a 
      WHERE a.user_id = r.user_id 
        AND a.festival_id = r.festival_id 
        AND a.date = DATE(r.start_at AT TIME ZONE f.timezone)
    );
END;
$$;


ALTER FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone) OWNER TO postgres;

--
-- Name: rpc_due_reservation_reminders(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone) RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone, reminder_offset_minutes integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at, r.reminder_offset_minutes
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.status = 'scheduled'
    AND p.reminders_enabled = true
    AND r.reminder_sent_at IS NULL
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) <= p_now;
END;
$$;


ALTER FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone) OWNER TO postgres;

--
-- Name: trigger_achievement_cache_invalidation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_achievement_cache_invalidation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_user_id UUID;
  v_festival_id UUID;
BEGIN
  -- Get user_id from achievement record
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- For achievements, we need to invalidate cache for all festivals this user participated in
  -- This is a simplified approach - in a real scenario you might want to be more specific
  PERFORM invalidate_wrapped_cache(v_user_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trigger_achievement_cache_invalidation() OWNER TO postgres;

--
-- Name: trigger_evaluate_achievements(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_evaluate_achievements() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  user_id_val uuid;
  festival_id_val uuid;
BEGIN
  -- Get user_id from the record
  user_id_val := COALESCE(NEW.user_id, OLD.user_id);
  
  -- Get festival_id based on table structure
  IF TG_TABLE_NAME = 'attendances' THEN
    festival_id_val := COALESCE(NEW.festival_id, OLD.festival_id);
  ELSIF TG_TABLE_NAME = 'tent_visits' THEN
    festival_id_val := COALESCE(NEW.festival_id, OLD.festival_id);
  ELSIF TG_TABLE_NAME = 'beer_pictures' THEN
    -- For beer_pictures, get festival_id through attendances
    SELECT a.festival_id INTO festival_id_val
    FROM attendances a
    WHERE a.id = COALESCE(NEW.attendance_id, OLD.attendance_id);
  ELSIF TG_TABLE_NAME = 'group_members' THEN
    -- For group_members, get festival_id through groups
    SELECT g.festival_id INTO festival_id_val
    FROM groups g
    WHERE g.id = COALESCE(NEW.group_id, OLD.group_id);
  END IF;
  
  -- Only proceed if we have both user_id and festival_id
  IF user_id_val IS NOT NULL AND festival_id_val IS NOT NULL THEN
    PERFORM evaluate_user_achievements(user_id_val, festival_id_val);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trigger_evaluate_achievements() OWNER TO postgres;

--
-- Name: trigger_tent_visit_cache_invalidation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_tent_visit_cache_invalidation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_user_id UUID;
  v_festival_id UUID;
BEGIN
  -- Get user_id and festival_id directly from the tent_visits record
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_festival_id := COALESCE(NEW.festival_id, OLD.festival_id);

  -- Invalidate cache for this user and festival
  IF v_user_id IS NOT NULL AND v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(v_user_id, v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trigger_tent_visit_cache_invalidation() OWNER TO postgres;

--
-- Name: trigger_wrapped_cache_invalidation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_wrapped_cache_invalidation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Invalidate cache for this user and festival when attendance data changes
  PERFORM invalidate_wrapped_cache(COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.festival_id, OLD.festival_id));

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.trigger_wrapped_cache_invalidation() OWNER TO postgres;

--
-- Name: unlock_achievement(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if already unlocked
  IF EXISTS (
    SELECT 1 FROM user_achievements 
    WHERE user_id = p_user_id 
    AND festival_id = p_festival_id 
    AND achievement_id = p_achievement_id
  ) THEN
    RETURN false; -- Already unlocked
  END IF;
  
  -- Insert the unlocked achievement
  INSERT INTO user_achievements (user_id, festival_id, achievement_id)
  VALUES (p_user_id, p_festival_id, p_achievement_id);
  
  RETURN true;
END;
$$;


ALTER FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) IS 'Unlocks an achievement for a user if not already unlocked';


--
-- Name: update_personal_attendance_with_tents(uuid, timestamp with time zone, integer, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) RETURNS TABLE(attendance_id uuid, tents_added uuid[], tents_removed uuid[])
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_unique_existing_tent_ids UUID[];
    v_last_tent_id UUID;
    v_tents_to_add UUID[];
    v_tents_to_remove UUID[];
    v_tent_id UUID;
BEGIN
    -- Update the attendance record (use date part for the attendance record)
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date::date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- Handle empty tent array - delete all tent visits for this date
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        -- Delete all tent visits for this date
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND visit_date::date = p_date::date
          AND festival_id = p_festival_id;

        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], ARRAY[]::UUID[];
        RETURN;
    END IF;

    -- Get existing tent visits for this date (ordered by visit time, most recent first)
    SELECT array_agg(tent_id ORDER BY visit_date DESC) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get unique tent IDs from existing visits
    SELECT array_agg(DISTINCT tent_id) INTO v_unique_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get the last tent ID if any exist (most recent visit)
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    IF v_unique_existing_tent_ids IS NULL THEN
        v_unique_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Determine which tents to remove (in existing but not in new list)
    v_tents_to_remove := ARRAY[]::UUID[];
    FOREACH v_tent_id IN ARRAY v_unique_existing_tent_ids
    LOOP
        IF NOT (v_tent_id = ANY(p_tent_ids)) THEN
            v_tents_to_remove := array_append(v_tents_to_remove, v_tent_id);
        END IF;
    END LOOP;

    -- Delete tent visits for removed tents (all visits for that tent on this date)
    IF array_length(v_tents_to_remove, 1) > 0 THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND visit_date::date = p_date::date
          AND festival_id = p_festival_id
          AND tent_id = ANY(v_tents_to_remove);
    END IF;

    -- Determine which tents to add
    v_tents_to_add := ARRAY[]::UUID[];

    -- Insert new tent visits with full timestamp (preserving time)
    -- Only add if this tent is different from the last tent visited
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        IF v_last_tent_id IS NULL OR v_tent_id != v_last_tent_id THEN
            -- Check if we just removed this tent - if so, skip adding to avoid immediate re-add
            IF NOT (v_tent_id = ANY(v_tents_to_remove)) THEN
                -- Only add if this tent isn't already in the existing visits
                IF NOT (v_tent_id = ANY(v_unique_existing_tent_ids)) THEN
                    INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
                    VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date, p_festival_id);
                    v_tents_to_add := array_append(v_tents_to_add, v_tent_id);
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_to_add, v_tents_to_remove;
END;
$$;


ALTER FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) IS 'Updates personal attendance records with tent visit management.
Supports adding new tents and removing deselected tents.
Preserves full timestamps for tent visits. Prevents duplicate consecutive tent visits.
Returns attendance_id, added tents, and removed tents.';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: update_user_group_photo_settings(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO user_group_photo_settings (user_id, group_id, hide_photos_from_group, updated_at)
    VALUES (p_user_id, p_group_id, p_hide_photos_from_group, NOW())
    ON CONFLICT (user_id, group_id) 
    DO UPDATE SET 
        hide_photos_from_group = p_hide_photos_from_group,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION public.update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean) OWNER TO postgres;

--
-- Name: update_user_photo_global_settings(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO user_photo_global_settings (user_id, hide_photos_from_all_groups, updated_at)
    VALUES (p_user_id, p_hide_photos_from_all_groups, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        hide_photos_from_all_groups = p_hide_photos_from_all_groups,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION public.update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean) OWNER TO postgres;

--
-- Name: update_wrapped_data_cache_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_wrapped_data_cache_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_wrapped_data_cache_updated_at() OWNER TO postgres;

--
-- Name: upsert_attendance_record(uuid, date, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_attendance_id UUID;
BEGIN
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    RETURN v_attendance_id;
END;
$$;


ALTER FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) IS 'Shared utility function for upserting attendance records without tent logic.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievement_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    festival_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    rarity public.achievement_rarity_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_notified_at timestamp with time zone,
    group_notified_at timestamp with time zone
);


ALTER TABLE public.achievement_events OWNER TO postgres;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category public.achievement_category_enum NOT NULL,
    icon text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    rarity public.achievement_rarity_enum DEFAULT 'common'::public.achievement_rarity_enum NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.achievements OWNER TO postgres;

--
-- Name: TABLE achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.achievements IS 'Core achievement definitions and metadata';


--
-- Name: attendances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    date date NOT NULL,
    beer_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    festival_id uuid NOT NULL
);

ALTER TABLE ONLY public.attendances FORCE ROW LEVEL SECURITY;


ALTER TABLE public.attendances OWNER TO postgres;

--
-- Name: beer_pictures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.beer_pictures (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    picture_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility public.photo_visibility_enum DEFAULT 'public'::public.photo_visibility_enum NOT NULL
);


ALTER TABLE public.beer_pictures OWNER TO postgres;

--
-- Name: consumptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attendance_id uuid NOT NULL,
    tent_id uuid,
    drink_type public.drink_type DEFAULT 'beer'::public.drink_type NOT NULL,
    drink_name text,
    base_price_cents integer NOT NULL,
    price_paid_cents integer NOT NULL,
    tip_cents integer GENERATED ALWAYS AS ((price_paid_cents - base_price_cents)) STORED,
    volume_ml integer DEFAULT 1000,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consumptions_paid_gte_base CHECK ((price_paid_cents >= base_price_cents)),
    CONSTRAINT consumptions_positive_price CHECK ((base_price_cents >= 0)),
    CONSTRAINT consumptions_positive_volume CHECK ((volume_ml > 0))
);


ALTER TABLE public.consumptions OWNER TO postgres;

--
-- Name: TABLE consumptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.consumptions IS 'Individual drink consumption records. Migrated from attendances.beer_count on 2025-12-29.';


--
-- Name: COLUMN consumptions.attendance_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.attendance_id IS 'References the attendance record for this consumption';


--
-- Name: COLUMN consumptions.tent_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.tent_id IS 'Optional tent where drink was purchased';


--
-- Name: COLUMN consumptions.drink_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.drink_type IS 'Type of beverage consumed';


--
-- Name: COLUMN consumptions.drink_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.drink_name IS 'Optional custom drink name (e.g., "Augustiner Edelstoff")';


--
-- Name: COLUMN consumptions.base_price_cents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.base_price_cents IS 'Base price of drink in cents (e.g., 1620 for €16.20)';


--
-- Name: COLUMN consumptions.price_paid_cents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.price_paid_cents IS 'Actual price paid including tip';


--
-- Name: COLUMN consumptions.tip_cents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.tip_cents IS 'Automatically calculated tip amount';


--
-- Name: COLUMN consumptions.volume_ml; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.volume_ml IS 'Volume in milliliters (default 1000ml for Maß)';


--
-- Name: COLUMN consumptions.recorded_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.recorded_at IS 'When the consumption was recorded';


--
-- Name: COLUMN consumptions.idempotency_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.consumptions.idempotency_key IS 'Optional key for preventing duplicate submissions';


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    group_id uuid,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_members OWNER TO postgres;

--
-- Name: groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.groups (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    description text,
    winning_criteria_id integer NOT NULL,
    invite_token uuid,
    token_expiration timestamp without time zone,
    festival_id uuid NOT NULL
);


ALTER TABLE public.groups OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    updated_at timestamp with time zone,
    username text,
    full_name text,
    avatar_url text,
    website text,
    is_super_admin boolean DEFAULT false,
    tutorial_completed boolean DEFAULT false,
    tutorial_completed_at timestamp with time zone,
    preferred_language text,
    CONSTRAINT username_length CHECK ((char_length(username) >= 3)),
    CONSTRAINT valid_language_code CHECK (((preferred_language IS NULL) OR (preferred_language = 'en'::text)))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.tutorial_completed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.tutorial_completed IS 'Whether the user has completed the initial tutorial';


--
-- Name: COLUMN profiles.tutorial_completed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.tutorial_completed_at IS 'Timestamp when the tutorial was completed';


--
-- Name: COLUMN profiles.preferred_language; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language code (ISO 639-1). NULL = auto-detect from browser.';


--
-- Name: tent_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tent_visits (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    tent_id uuid NOT NULL,
    visit_date timestamp with time zone,
    festival_id uuid NOT NULL
);


ALTER TABLE public.tent_visits OWNER TO postgres;

--
-- Name: tents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tents (
    id uuid NOT NULL,
    name character varying NOT NULL,
    category character varying,
    CONSTRAINT tents_category_check CHECK (((category)::text = ANY (ARRAY[('large'::character varying)::text, ('small'::character varying)::text, ('old'::character varying)::text])))
);


ALTER TABLE public.tents OWNER TO postgres;

--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    festival_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL,
    progress jsonb
);


ALTER TABLE public.user_achievements OWNER TO postgres;

--
-- Name: TABLE user_achievements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_achievements IS 'User-specific achievement unlocks per festival';


--
-- Name: activity_feed; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.activity_feed WITH (security_invoker='true') AS
 WITH user_group_members AS (
         SELECT DISTINCT gm2.user_id,
            gm2.group_id,
            g.festival_id
           FROM ((public.group_members gm1
             JOIN public.group_members gm2 ON ((gm1.group_id = gm2.group_id)))
             JOIN public.groups g ON ((g.id = gm1.group_id)))
          WHERE ((gm1.user_id = auth.uid()) AND (gm2.user_id <> auth.uid()))
        ), recent_consumptions AS (
         SELECT a.user_id,
            a.festival_id,
            'beer_count_update'::public.activity_type_enum AS activity_type,
            jsonb_build_object('drink_type', (c.drink_type)::text, 'drink_count', (count(*))::integer, 'beer_count', (count(*))::integer, 'date', a.date, 'attendance_id', a.id) AS activity_data,
            max(c.recorded_at) AS activity_time,
            min(c.created_at) AS created_at,
            max(c.updated_at) AS updated_at
           FROM ((public.consumptions c
             JOIN public.attendances a ON ((a.id = c.attendance_id)))
             JOIN user_group_members ugm ON (((ugm.user_id = a.user_id) AND (ugm.festival_id = a.festival_id))))
          WHERE (c.recorded_at > (now() - '48:00:00'::interval))
          GROUP BY a.user_id, a.festival_id, a.id, a.date, c.drink_type
        ), recent_tent_visits AS (
         SELECT tv.user_id,
            tv.festival_id,
            'tent_checkin'::public.activity_type_enum AS activity_type,
            jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
            tv.visit_date AS activity_time,
            tv.visit_date AS created_at,
            tv.visit_date AS updated_at
           FROM ((public.tent_visits tv
             JOIN public.tents t ON ((t.id = tv.tent_id)))
             JOIN user_group_members ugm ON (((ugm.user_id = tv.user_id) AND (ugm.festival_id = tv.festival_id))))
          WHERE (tv.visit_date > (now() - '48:00:00'::interval))
        ), recent_photos AS (
         SELECT bp.user_id,
            a.festival_id,
            'photo_upload'::public.activity_type_enum AS activity_type,
            jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
            bp.created_at AS activity_time,
            bp.created_at,
            bp.created_at AS updated_at
           FROM ((public.beer_pictures bp
             JOIN public.attendances a ON ((a.id = bp.attendance_id)))
             JOIN user_group_members ugm ON (((ugm.user_id = bp.user_id) AND (ugm.festival_id = a.festival_id))))
          WHERE ((bp.created_at > (now() - '48:00:00'::interval)) AND (bp.visibility = 'public'::public.photo_visibility_enum))
        ), recent_group_joins AS (
         SELECT gm.user_id,
            g.festival_id,
            'group_join'::public.activity_type_enum AS activity_type,
            jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
            gm.joined_at AS activity_time,
            gm.joined_at AS created_at,
            gm.joined_at AS updated_at
           FROM ((public.group_members gm
             JOIN public.groups g ON ((g.id = gm.group_id)))
             JOIN user_group_members ugm ON (((ugm.user_id = gm.user_id) AND (ugm.festival_id = g.festival_id))))
          WHERE (gm.joined_at > (now() - '48:00:00'::interval))
        ), recent_achievements AS (
         SELECT ua.user_id,
            ua.festival_id,
            'achievement_unlock'::public.activity_type_enum AS activity_type,
            jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', ach.name, 'achievement_icon', ach.icon, 'rarity', ach.rarity) AS activity_data,
            ua.unlocked_at AS activity_time,
            ua.unlocked_at AS created_at,
            ua.unlocked_at AS updated_at
           FROM ((public.user_achievements ua
             JOIN public.achievements ach ON ((ach.id = ua.achievement_id)))
             JOIN user_group_members ugm ON (((ugm.user_id = ua.user_id) AND (ugm.festival_id = ua.festival_id))))
          WHERE (ua.unlocked_at > (now() - '48:00:00'::interval))
        ), all_activities AS (
         SELECT recent_consumptions.user_id,
            recent_consumptions.festival_id,
            recent_consumptions.activity_type,
            recent_consumptions.activity_data,
            recent_consumptions.activity_time,
            recent_consumptions.created_at,
            recent_consumptions.updated_at
           FROM recent_consumptions
        UNION ALL
         SELECT recent_tent_visits.user_id,
            recent_tent_visits.festival_id,
            recent_tent_visits.activity_type,
            recent_tent_visits.activity_data,
            recent_tent_visits.activity_time,
            recent_tent_visits.created_at,
            recent_tent_visits.updated_at
           FROM recent_tent_visits
        UNION ALL
         SELECT recent_photos.user_id,
            recent_photos.festival_id,
            recent_photos.activity_type,
            recent_photos.activity_data,
            recent_photos.activity_time,
            recent_photos.created_at,
            recent_photos.updated_at
           FROM recent_photos
        UNION ALL
         SELECT recent_group_joins.user_id,
            recent_group_joins.festival_id,
            recent_group_joins.activity_type,
            recent_group_joins.activity_data,
            recent_group_joins.activity_time,
            recent_group_joins.created_at,
            recent_group_joins.updated_at
           FROM recent_group_joins
        UNION ALL
         SELECT recent_achievements.user_id,
            recent_achievements.festival_id,
            recent_achievements.activity_type,
            recent_achievements.activity_data,
            recent_achievements.activity_time,
            recent_achievements.created_at,
            recent_achievements.updated_at
           FROM recent_achievements
        )
 SELECT aa.user_id,
    aa.festival_id,
    aa.activity_type,
    aa.activity_data,
    aa.activity_time,
    p.username,
    p.full_name,
    p.avatar_url
   FROM (all_activities aa
     JOIN public.profiles p ON ((p.id = aa.user_id)))
  ORDER BY aa.activity_time DESC;


ALTER VIEW public.activity_feed OWNER TO postgres;

--
-- Name: attendance_with_totals; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.attendance_with_totals WITH (security_invoker='true') AS
 SELECT a.id,
    a.user_id,
    a.festival_id,
    a.date,
    a.created_at,
    a.updated_at,
    COALESCE(c.drink_count, (0)::bigint) AS drink_count,
    COALESCE(c.beer_count, (a.beer_count)::bigint, (0)::bigint) AS beer_count,
    COALESCE(c.total_spent_cents, (0)::bigint) AS total_spent_cents,
    COALESCE(c.total_tip_cents, (0)::bigint) AS total_tip_cents,
    COALESCE(c.avg_price_cents, 0) AS avg_price_cents
   FROM (public.attendances a
     LEFT JOIN LATERAL ( SELECT count(*) AS drink_count,
            count(*) FILTER (WHERE (consumptions.drink_type = ANY (ARRAY['beer'::public.drink_type, 'radler'::public.drink_type]))) AS beer_count,
            sum(consumptions.price_paid_cents) AS total_spent_cents,
            sum(consumptions.tip_cents) AS total_tip_cents,
            (avg(consumptions.price_paid_cents))::integer AS avg_price_cents
           FROM public.consumptions
          WHERE (consumptions.attendance_id = a.id)
         HAVING (count(*) > 0)) c ON (true));


ALTER VIEW public.attendance_with_totals OWNER TO postgres;

--
-- Name: festival_tents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.festival_tents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    festival_id uuid NOT NULL,
    tent_id uuid NOT NULL,
    beer_price numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT festival_tents_beer_price_check CHECK (((beer_price IS NULL) OR (beer_price > (0)::numeric)))
);


ALTER TABLE public.festival_tents OWNER TO postgres;

--
-- Name: TABLE festival_tents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.festival_tents IS 'Clean junction table linking festivals to their available tents with optional tent-specific pricing. Replaces the old festival_tent_pricing table.';


--
-- Name: COLUMN festival_tents.festival_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.festival_tents.festival_id IS 'References the festival this tent belongs to';


--
-- Name: COLUMN festival_tents.tent_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.festival_tents.tent_id IS 'References the tent available in this festival';


--
-- Name: COLUMN festival_tents.beer_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.festival_tents.beer_price IS 'Optional tent-specific beer price. NULL means use festival default price';


--
-- Name: festivals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.festivals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    short_name character varying(100) NOT NULL,
    festival_type public.festival_type_enum NOT NULL,
    location character varying(255) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    map_url text,
    timezone character varying(100) DEFAULT 'Europe/Berlin'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    status public.festival_status_enum NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    beer_cost numeric(5,2),
    CONSTRAINT festivals_beer_cost_check CHECK (((beer_cost IS NULL) OR (beer_cost > (0)::numeric)))
);


ALTER TABLE public.festivals OWNER TO postgres;

--
-- Name: COLUMN festivals.beer_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.festivals.beer_cost IS 'Default beer price for this festival. Used as fallback when tents do not have specific pricing in festival_tents table.';


--
-- Name: leaderboard; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.leaderboard WITH (security_invoker='true') AS
 SELECT p.id AS user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    g.id AS group_id,
    g.name AS group_name,
    count(DISTINCT a.date) AS days_attended,
    COALESCE(avg(a.beer_count), (0)::numeric) AS avg_beers,
    COALESCE(sum(a.beer_count), (0)::bigint) AS total_beers
   FROM (((public.profiles p
     JOIN public.group_members gm ON ((p.id = gm.user_id)))
     JOIN public.groups g ON ((gm.group_id = g.id)))
     LEFT JOIN public.attendances a ON ((p.id = a.user_id)))
  WHERE ((gm.group_id = g.id) AND (EXISTS ( SELECT 1
           FROM public.group_members
          WHERE ((group_members.group_id = g.id) AND (group_members.user_id = auth.uid())))))
  GROUP BY p.id, p.username, p.full_name, p.avatar_url, g.id, g.name;


ALTER VIEW public.leaderboard OWNER TO postgres;

--
-- Name: location_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_points_positive_accuracy CHECK (((accuracy IS NULL) OR (accuracy >= (0)::double precision))),
    CONSTRAINT location_points_valid_latitude CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT location_points_valid_longitude CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))
);


ALTER TABLE public.location_points OWNER TO postgres;

--
-- Name: TABLE location_points; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.location_points IS 'Append-only location history for tracking user positions';


--
-- Name: COLUMN location_points.accuracy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_points.accuracy IS 'GPS accuracy in meters (optional)';


--
-- Name: COLUMN location_points.recorded_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_points.recorded_at IS 'When the location was recorded';


--
-- Name: location_session_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_session_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.location_session_members OWNER TO postgres;

--
-- Name: TABLE location_session_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.location_session_members IS 'Groups that can view a location session';


--
-- Name: COLUMN location_session_members.group_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_session_members.group_id IS 'Group members who can see this location';


--
-- Name: location_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    festival_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '04:00:00'::interval) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_sessions_expires_after_start CHECK ((expires_at > started_at))
);


ALTER TABLE public.location_sessions OWNER TO postgres;

--
-- Name: TABLE location_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.location_sessions IS 'Active location sharing sessions with auto-expiration';


--
-- Name: COLUMN location_sessions.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_sessions.expires_at IS 'When the session automatically expires (default 4 hours)';


--
-- Name: COLUMN location_sessions.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_sessions.is_active IS 'Whether the session is currently active';


--
-- Name: notification_rate_limit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_rate_limit (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid,
    notification_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_rate_limit OWNER TO postgres;

--
-- Name: reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    festival_id uuid NOT NULL,
    tent_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    reminder_offset_minutes integer DEFAULT 1440 NOT NULL,
    reminder_sent_at timestamp with time zone,
    prompt_sent_at timestamp with time zone,
    processed_at timestamp with time zone,
    visible_to_groups boolean DEFAULT true NOT NULL,
    auto_checkin boolean DEFAULT false NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reservations OWNER TO postgres;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.system_settings IS 'System-wide configurable settings and parameters';


--
-- Name: user_group_photo_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_group_photo_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid NOT NULL,
    hide_photos_from_group boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_group_photo_settings OWNER TO postgres;

--
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_notification_preferences (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    group_join_enabled boolean DEFAULT true,
    checkin_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reminders_enabled boolean DEFAULT true,
    group_notifications_enabled boolean DEFAULT true,
    achievement_notifications_enabled boolean DEFAULT true
);


ALTER TABLE public.user_notification_preferences OWNER TO postgres;

--
-- Name: user_photo_global_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_photo_global_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    hide_photos_from_all_groups boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_photo_global_settings OWNER TO postgres;

--
-- Name: v_user_shared_group_members; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_user_shared_group_members WITH (security_invoker='true') AS
 SELECT gm1.user_id AS owner_id,
    gm2.user_id AS viewer_id,
    g.festival_id
   FROM ((public.group_members gm1
     JOIN public.group_members gm2 ON (((gm1.group_id = gm2.group_id) AND (gm1.user_id <> gm2.user_id))))
     JOIN public.groups g ON ((g.id = gm1.group_id)));


ALTER VIEW public.v_user_shared_group_members OWNER TO postgres;

--
-- Name: winning_criteria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.winning_criteria (
    id integer NOT NULL,
    name character varying(20) NOT NULL
);


ALTER TABLE public.winning_criteria OWNER TO postgres;

--
-- Name: winning_criteria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.winning_criteria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.winning_criteria_id_seq OWNER TO postgres;

--
-- Name: winning_criteria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.winning_criteria_id_seq OWNED BY public.winning_criteria.id;


--
-- Name: wrapped_data_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wrapped_data_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    festival_id uuid NOT NULL,
    wrapped_data jsonb NOT NULL,
    generated_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wrapped_data_cache_generated_by_check CHECK ((generated_by = ANY (ARRAY['system'::text, 'admin'::text])))
);


ALTER TABLE public.wrapped_data_cache OWNER TO postgres;

--
-- Name: winning_criteria id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.winning_criteria ALTER COLUMN id SET DEFAULT nextval('public.winning_criteria_id_seq'::regclass);


--
-- Name: achievement_events achievement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_events
    ADD CONSTRAINT achievement_events_pkey PRIMARY KEY (id);


--
-- Name: achievements achievements_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_name_key UNIQUE (name);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: beer_pictures beer_pictures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beer_pictures
    ADD CONSTRAINT beer_pictures_pkey PRIMARY KEY (id);


--
-- Name: consumptions consumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumptions
    ADD CONSTRAINT consumptions_pkey PRIMARY KEY (id);


--
-- Name: festival_tents festival_tents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festival_tents
    ADD CONSTRAINT festival_tents_pkey PRIMARY KEY (id);


--
-- Name: festivals festivals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festivals
    ADD CONSTRAINT festivals_pkey PRIMARY KEY (id);


--
-- Name: festivals festivals_short_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festivals
    ADD CONSTRAINT festivals_short_name_key UNIQUE (short_name);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: location_points location_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_points
    ADD CONSTRAINT location_points_pkey PRIMARY KEY (id);


--
-- Name: location_session_members location_session_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_session_members
    ADD CONSTRAINT location_session_members_pkey PRIMARY KEY (id);


--
-- Name: location_session_members location_session_members_session_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_session_members
    ADD CONSTRAINT location_session_members_session_id_group_id_key UNIQUE (session_id, group_id);


--
-- Name: location_sessions location_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_sessions
    ADD CONSTRAINT location_sessions_pkey PRIMARY KEY (id);


--
-- Name: notification_rate_limit notification_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rate_limit
    ADD CONSTRAINT notification_rate_limit_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tent_visits tent_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tent_visits
    ADD CONSTRAINT tent_visits_pkey PRIMARY KEY (id);


--
-- Name: tents tents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tents
    ADD CONSTRAINT tents_pkey PRIMARY KEY (id);


--
-- Name: festival_tents unique_festival_tent; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festival_tents
    ADD CONSTRAINT unique_festival_tent UNIQUE (festival_id, tent_id);


--
-- Name: groups unique_group_name_festival; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT unique_group_name_festival UNIQUE (name, festival_id);


--
-- Name: attendances unique_user_date_festival; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT unique_user_date_festival UNIQUE (user_id, date, festival_id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_user_id_achievement_id_festival_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_festival_id_key UNIQUE (user_id, achievement_id, festival_id);


--
-- Name: user_group_photo_settings user_group_photo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_photo_settings
    ADD CONSTRAINT user_group_photo_settings_pkey PRIMARY KEY (id);


--
-- Name: user_group_photo_settings user_group_photo_settings_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_photo_settings
    ADD CONSTRAINT user_group_photo_settings_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_notification_preferences user_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_photo_global_settings user_photo_global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photo_global_settings
    ADD CONSTRAINT user_photo_global_settings_pkey PRIMARY KEY (id);


--
-- Name: user_photo_global_settings user_photo_global_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photo_global_settings
    ADD CONSTRAINT user_photo_global_settings_user_id_key UNIQUE (user_id);


--
-- Name: winning_criteria winning_criteria_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.winning_criteria
    ADD CONSTRAINT winning_criteria_name_key UNIQUE (name);


--
-- Name: winning_criteria winning_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.winning_criteria
    ADD CONSTRAINT winning_criteria_pkey PRIMARY KEY (id);


--
-- Name: wrapped_data_cache wrapped_data_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wrapped_data_cache
    ADD CONSTRAINT wrapped_data_cache_pkey PRIMARY KEY (id);


--
-- Name: wrapped_data_cache wrapped_data_cache_user_id_festival_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wrapped_data_cache
    ADD CONSTRAINT wrapped_data_cache_user_id_festival_id_key UNIQUE (user_id, festival_id);


--
-- Name: idx_achievement_events_festival_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievement_events_festival_created ON public.achievement_events USING btree (festival_id, created_at);


--
-- Name: idx_achievement_events_group_notified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievement_events_group_notified ON public.achievement_events USING btree (group_notified_at);


--
-- Name: idx_achievement_events_user_notified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievement_events_user_notified ON public.achievement_events USING btree (user_notified_at);


--
-- Name: idx_achievements_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_active ON public.achievements USING btree (is_active);


--
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- Name: idx_achievements_rarity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_achievements_rarity ON public.achievements USING btree (rarity);


--
-- Name: idx_activity_feed_festival_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_feed_festival_time ON public.attendances USING btree (festival_id, GREATEST(created_at, updated_at) DESC);


--
-- Name: idx_attendances_festival_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendances_festival_id ON public.attendances USING btree (festival_id);


--
-- Name: idx_attendances_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendances_user_date ON public.attendances USING btree (user_id, date);


--
-- Name: idx_attendances_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendances_user_id ON public.attendances USING btree (user_id);


--
-- Name: idx_beer_pictures_attendance_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beer_pictures_attendance_id ON public.beer_pictures USING btree (attendance_id);


--
-- Name: idx_beer_pictures_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beer_pictures_time ON public.beer_pictures USING btree (created_at DESC);


--
-- Name: idx_beer_pictures_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beer_pictures_user_id ON public.beer_pictures USING btree (user_id);


--
-- Name: idx_beer_pictures_visibility; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beer_pictures_visibility ON public.beer_pictures USING btree (visibility);


--
-- Name: idx_consumptions_attendance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumptions_attendance ON public.consumptions USING btree (attendance_id);


--
-- Name: idx_consumptions_drink_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumptions_drink_type ON public.consumptions USING btree (drink_type);


--
-- Name: idx_consumptions_idempotency_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_consumptions_idempotency_unique ON public.consumptions USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_consumptions_recorded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumptions_recorded_at ON public.consumptions USING btree (recorded_at DESC);


--
-- Name: idx_consumptions_tent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumptions_tent ON public.consumptions USING btree (tent_id);


--
-- Name: idx_festival_tents_festival_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festival_tents_festival_id ON public.festival_tents USING btree (festival_id);


--
-- Name: idx_festival_tents_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festival_tents_lookup ON public.festival_tents USING btree (festival_id, tent_id);


--
-- Name: idx_festival_tents_tent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festival_tents_tent_id ON public.festival_tents USING btree (tent_id);


--
-- Name: idx_festivals_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festivals_dates ON public.festivals USING btree (start_date, end_date);


--
-- Name: idx_festivals_single_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_festivals_single_active ON public.festivals USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_festivals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festivals_status ON public.festivals USING btree (status);


--
-- Name: idx_festivals_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_festivals_type ON public.festivals USING btree (festival_type);


--
-- Name: idx_group_members_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_members_group_id ON public.group_members USING btree (group_id);


--
-- Name: idx_group_members_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_members_time ON public.group_members USING btree (joined_at DESC);


--
-- Name: idx_group_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_members_user_id ON public.group_members USING btree (user_id);


--
-- Name: idx_groups_festival_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_festival_id ON public.groups USING btree (festival_id);


--
-- Name: idx_location_points_recorded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_points_recorded ON public.location_points USING btree (recorded_at DESC);


--
-- Name: idx_location_points_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_points_session ON public.location_points USING btree (session_id);


--
-- Name: idx_location_points_session_recorded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_points_session_recorded ON public.location_points USING btree (session_id, recorded_at DESC);


--
-- Name: idx_location_session_members_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_session_members_group ON public.location_session_members USING btree (group_id);


--
-- Name: idx_location_session_members_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_session_members_session ON public.location_session_members USING btree (session_id);


--
-- Name: idx_location_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_sessions_active ON public.location_sessions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_location_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_sessions_expires ON public.location_sessions USING btree (expires_at) WHERE (is_active = true);


--
-- Name: idx_location_sessions_festival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_sessions_festival ON public.location_sessions USING btree (festival_id);


--
-- Name: idx_location_sessions_one_active_per_user_festival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_location_sessions_one_active_per_user_festival ON public.location_sessions USING btree (user_id, festival_id, is_active) WHERE (is_active = true);


--
-- Name: idx_location_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_sessions_user ON public.location_sessions USING btree (user_id);


--
-- Name: idx_notification_rate_limit_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_rate_limit_lookup ON public.notification_rate_limit USING btree (user_id, notification_type, group_id, created_at);


--
-- Name: idx_profiles_tutorial_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_tutorial_completed ON public.profiles USING btree (tutorial_completed);


--
-- Name: idx_reservations_festival_start_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_festival_start_at ON public.reservations USING btree (festival_id, start_at);


--
-- Name: idx_reservations_status_start_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_status_start_at ON public.reservations USING btree (status, start_at);


--
-- Name: idx_reservations_tent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_tent ON public.reservations USING btree (tent_id);


--
-- Name: idx_reservations_user_start_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_user_start_at ON public.reservations USING btree (user_id, start_at);


--
-- Name: idx_reservations_visible_to_groups; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_visible_to_groups ON public.reservations USING btree (visible_to_groups);


--
-- Name: idx_tent_visits_festival_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tent_visits_festival_id ON public.tent_visits USING btree (festival_id);


--
-- Name: idx_tent_visits_festival_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tent_visits_festival_time ON public.tent_visits USING btree (festival_id, visit_date DESC);


--
-- Name: idx_user_achievements_achievement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_achievement ON public.user_achievements USING btree (achievement_id);


--
-- Name: idx_user_achievements_festival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_festival ON public.user_achievements USING btree (festival_id);


--
-- Name: idx_user_achievements_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_time ON public.user_achievements USING btree (unlocked_at DESC);


--
-- Name: idx_user_achievements_user_festival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_achievements_user_festival ON public.user_achievements USING btree (user_id, festival_id);


--
-- Name: idx_user_group_photo_settings_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_group_photo_settings_group_id ON public.user_group_photo_settings USING btree (group_id);


--
-- Name: idx_user_group_photo_settings_user_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_group_photo_settings_user_group ON public.user_group_photo_settings USING btree (user_id, group_id);


--
-- Name: idx_user_group_photo_settings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_group_photo_settings_user_id ON public.user_group_photo_settings USING btree (user_id);


--
-- Name: idx_user_photo_global_settings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_photo_global_settings_user_id ON public.user_photo_global_settings USING btree (user_id);


--
-- Name: idx_wrapped_data_cache_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wrapped_data_cache_admin ON public.wrapped_data_cache USING btree (generated_by, updated_at DESC);


--
-- Name: idx_wrapped_data_cache_user_festival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wrapped_data_cache_user_festival ON public.wrapped_data_cache USING btree (user_id, festival_id);


--
-- Name: attendances achievements_on_attendance_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER achievements_on_attendance_change AFTER INSERT OR DELETE OR UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.trigger_evaluate_achievements();


--
-- Name: beer_pictures achievements_on_beer_picture_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER achievements_on_beer_picture_change AFTER INSERT OR DELETE OR UPDATE ON public.beer_pictures FOR EACH ROW EXECUTE FUNCTION public.trigger_evaluate_achievements();


--
-- Name: group_members achievements_on_group_member_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER achievements_on_group_member_change AFTER INSERT OR DELETE OR UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.trigger_evaluate_achievements();


--
-- Name: tent_visits achievements_on_tent_visit_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER achievements_on_tent_visit_change AFTER INSERT OR DELETE OR UPDATE ON public.tent_visits FOR EACH ROW EXECUTE FUNCTION public.trigger_evaluate_achievements();


--
-- Name: profiles create_notification_preferences_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER create_notification_preferences_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();


--
-- Name: groups set_group_token; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_group_token BEFORE INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.generate_group_token();


--
-- Name: attendances tr_attendances_wrapped_cache_invalidation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_attendances_wrapped_cache_invalidation AFTER INSERT OR DELETE OR UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.trigger_wrapped_cache_invalidation();


--
-- Name: tent_visits tr_tent_visits_wrapped_cache_invalidation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_tent_visits_wrapped_cache_invalidation AFTER INSERT OR DELETE OR UPDATE ON public.tent_visits FOR EACH ROW EXECUTE FUNCTION public.trigger_tent_visit_cache_invalidation();


--
-- Name: user_achievements tr_user_achievements_wrapped_cache_invalidation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_user_achievements_wrapped_cache_invalidation AFTER INSERT OR DELETE OR UPDATE ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.trigger_achievement_cache_invalidation();


--
-- Name: wrapped_data_cache tr_wrapped_data_cache_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_wrapped_data_cache_updated_at BEFORE UPDATE ON public.wrapped_data_cache FOR EACH ROW EXECUTE FUNCTION public.update_wrapped_data_cache_updated_at();


--
-- Name: user_achievements trg_user_achievements_insert_event; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_achievements_insert_event AFTER INSERT ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.insert_achievement_event_from_unlock();


--
-- Name: achievements update_achievements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON public.achievements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendances update_attendances_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consumptions update_consumptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_consumptions_updated_at BEFORE UPDATE ON public.consumptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: festival_tents update_festival_tents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_festival_tents_updated_at BEFORE UPDATE ON public.festival_tents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: festivals update_festivals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_festivals_updated_at BEFORE UPDATE ON public.festivals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: location_sessions update_location_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_location_sessions_updated_at BEFORE UPDATE ON public.location_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservations update_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: achievement_events achievement_events_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_events
    ADD CONSTRAINT achievement_events_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: achievement_events achievement_events_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_events
    ADD CONSTRAINT achievement_events_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: achievement_events achievement_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievement_events
    ADD CONSTRAINT achievement_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id);


--
-- Name: attendances attendances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: beer_pictures beer_pictures_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beer_pictures
    ADD CONSTRAINT beer_pictures_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id);


--
-- Name: beer_pictures beer_pictures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beer_pictures
    ADD CONSTRAINT beer_pictures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: beer_pictures beer_pictures_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beer_pictures
    ADD CONSTRAINT beer_pictures_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: consumptions consumptions_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumptions
    ADD CONSTRAINT consumptions_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendances(id) ON DELETE CASCADE;


--
-- Name: consumptions consumptions_tent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumptions
    ADD CONSTRAINT consumptions_tent_id_fkey FOREIGN KEY (tent_id) REFERENCES public.tents(id) ON DELETE SET NULL;


--
-- Name: festival_tents festival_tents_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festival_tents
    ADD CONSTRAINT festival_tents_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: festival_tents festival_tents_tent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.festival_tents
    ADD CONSTRAINT festival_tents_tent_id_fkey FOREIGN KEY (tent_id) REFERENCES public.tents(id) ON DELETE CASCADE;


--
-- Name: group_members fk_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: groups groups_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id);


--
-- Name: groups groups_winning_criteria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_winning_criteria_id_fkey FOREIGN KEY (winning_criteria_id) REFERENCES public.winning_criteria(id) ON DELETE CASCADE;


--
-- Name: location_points location_points_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_points
    ADD CONSTRAINT location_points_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.location_sessions(id) ON DELETE CASCADE;


--
-- Name: location_session_members location_session_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_session_members
    ADD CONSTRAINT location_session_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: location_session_members location_session_members_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_session_members
    ADD CONSTRAINT location_session_members_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.location_sessions(id) ON DELETE CASCADE;


--
-- Name: location_sessions location_sessions_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_sessions
    ADD CONSTRAINT location_sessions_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: location_sessions location_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_sessions
    ADD CONSTRAINT location_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_rate_limit notification_rate_limit_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rate_limit
    ADD CONSTRAINT notification_rate_limit_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: notification_rate_limit notification_rate_limit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rate_limit
    ADD CONSTRAINT notification_rate_limit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: reservations reservations_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: reservations reservations_tent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_tent_id_fkey FOREIGN KEY (tent_id) REFERENCES public.tents(id) ON DELETE RESTRICT;


--
-- Name: reservations reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tent_visits tent_visits_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tent_visits
    ADD CONSTRAINT tent_visits_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id);


--
-- Name: tent_visits tent_visits_tent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tent_visits
    ADD CONSTRAINT tent_visits_tent_id_fkey FOREIGN KEY (tent_id) REFERENCES public.tents(id);


--
-- Name: tent_visits tent_visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tent_visits
    ADD CONSTRAINT tent_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: user_group_photo_settings user_group_photo_settings_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_photo_settings
    ADD CONSTRAINT user_group_photo_settings_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: user_group_photo_settings user_group_photo_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_photo_settings
    ADD CONSTRAINT user_group_photo_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_photo_global_settings user_photo_global_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photo_global_settings
    ADD CONSTRAINT user_photo_global_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wrapped_data_cache wrapped_data_cache_festival_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wrapped_data_cache
    ADD CONSTRAINT wrapped_data_cache_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;


--
-- Name: wrapped_data_cache wrapped_data_cache_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wrapped_data_cache
    ADD CONSTRAINT wrapped_data_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: achievements Achievements are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Achievements are viewable by everyone" ON public.achievements FOR SELECT USING (true);


--
-- Name: wrapped_data_cache Admins can manage wrapped cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage wrapped cache" ON public.wrapped_data_cache USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))));


--
-- Name: tents Anyone can view tents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view tents" ON public.tents FOR SELECT TO authenticated USING (true);


--
-- Name: winning_criteria Anyone can view winning criteria; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view winning criteria" ON public.winning_criteria FOR SELECT TO authenticated USING (true);


--
-- Name: festival_tents Festival tents are viewable by all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Festival tents are viewable by all authenticated users" ON public.festival_tents FOR SELECT TO authenticated USING (true);


--
-- Name: festivals Festivals are viewable by all authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Festivals are viewable by all authenticated users" ON public.festivals FOR SELECT TO authenticated USING (true);


--
-- Name: groups Group creators can update their groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group creators can update their groups" ON public.groups FOR UPDATE USING ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: consumptions Group members can view member consumptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group members can view member consumptions" ON public.consumptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (((public.attendances a
     JOIN public.group_members gm1 ON ((gm1.user_id = a.user_id)))
     JOIN public.groups g ON ((g.id = gm1.group_id)))
     JOIN public.group_members gm2 ON ((gm2.group_id = g.id)))
  WHERE ((a.id = consumptions.attendance_id) AND (gm2.user_id = auth.uid()) AND (a.festival_id = g.festival_id)))));


--
-- Name: location_session_members Group members can view session members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group members can view session members" ON public.location_session_members FOR SELECT USING ((group_id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid()))));


--
-- Name: location_points Group members can view shared location points; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group members can view shared location points" ON public.location_points FOR SELECT USING ((session_id IN ( SELECT ls.id
   FROM ((public.location_sessions ls
     JOIN public.location_session_members lsm ON ((lsm.session_id = ls.id)))
     JOIN public.group_members gm ON ((gm.group_id = lsm.group_id)))
  WHERE ((gm.user_id = auth.uid()) AND (ls.is_active = true) AND (ls.expires_at > now())))));


--
-- Name: location_sessions Group members can view shared sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group members can view shared sessions" ON public.location_sessions FOR SELECT USING ((id IN ( SELECT lsm.session_id
   FROM (public.location_session_members lsm
     JOIN public.group_members gm ON ((gm.group_id = lsm.group_id)))
  WHERE (gm.user_id = auth.uid()))));


--
-- Name: reservations Group members can view visible reservations in same festival; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Group members can view visible reservations in same festival" ON public.reservations FOR SELECT TO authenticated USING (((visible_to_groups = true) AND (EXISTS ( SELECT 1
   FROM public.v_user_shared_group_members v
  WHERE ((v.owner_id = reservations.user_id) AND (v.viewer_id = auth.uid()) AND (v.festival_id = reservations.festival_id))))));


--
-- Name: festival_tents Only super admins can manage festival tents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only super admins can manage festival tents" ON public.festival_tents TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))));


--
-- Name: achievements Only super admins can modify achievements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only super admins can modify achievements" ON public.achievements USING (public.is_super_admin());


--
-- Name: system_settings Only super admins can modify system settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only super admins can modify system settings" ON public.system_settings USING (public.is_super_admin());


--
-- Name: profiles Public profiles are viewable by everyone.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);


--
-- Name: attendances Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.attendances USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: group_members Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.group_members USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: groups Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.groups USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: profiles Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.profiles USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: tent_visits Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.tent_visits USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: tents Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.tents USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: winning_criteria Super admins can do anything; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything" ON public.winning_criteria USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: beer_pictures Super admins can do anything with beer pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can do anything with beer pictures" ON public.beer_pictures TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: festivals Super admins can manage festivals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can manage festivals" ON public.festivals TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))));


--
-- Name: user_achievements Super admins can modify user achievements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can modify user achievements" ON public.user_achievements USING (public.is_super_admin());


--
-- Name: user_achievements Super admins can view all user achievements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can view all user achievements" ON public.user_achievements FOR SELECT USING (public.is_super_admin());


--
-- Name: notification_rate_limit System can insert rate limit records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert rate limit records" ON public.notification_rate_limit FOR INSERT WITH CHECK (true);


--
-- Name: system_settings System settings are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System settings are viewable by everyone" ON public.system_settings FOR SELECT USING (true);


--
-- Name: groups Users can create groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));


--
-- Name: attendances Users can delete own attendance; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own attendance" ON public.attendances FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: beer_pictures Users can delete own beer pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own beer pictures" ON public.beer_pictures FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: consumptions Users can delete own consumptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own consumptions" ON public.consumptions FOR DELETE USING ((attendance_id IN ( SELECT attendances.id
   FROM public.attendances
  WHERE (attendances.user_id = auth.uid()))));


--
-- Name: location_sessions Users can delete own location sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own location sessions" ON public.location_sessions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: reservations Users can delete own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own reservations" ON public.reservations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: tent_visits Users can delete own tent visits; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own tent visits" ON public.tent_visits FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: wrapped_data_cache Users can delete own wrapped cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own wrapped cache" ON public.wrapped_data_cache FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_photo_global_settings Users can delete their own global photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own global photo settings" ON public.user_photo_global_settings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_group_photo_settings Users can delete their own group photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own group photo settings" ON public.user_group_photo_settings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: attendances Users can insert own attendance; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own attendance" ON public.attendances FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: beer_pictures Users can insert own beer pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own beer pictures" ON public.beer_pictures FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: consumptions Users can insert own consumptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own consumptions" ON public.consumptions FOR INSERT WITH CHECK ((attendance_id IN ( SELECT attendances.id
   FROM public.attendances
  WHERE (attendances.user_id = auth.uid()))));


--
-- Name: location_points Users can insert own location points; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own location points" ON public.location_points FOR INSERT WITH CHECK ((session_id IN ( SELECT location_sessions.id
   FROM public.location_sessions
  WHERE (location_sessions.user_id = auth.uid()))));


--
-- Name: location_sessions Users can insert own location sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own location sessions" ON public.location_sessions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: reservations Users can insert own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own reservations" ON public.reservations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: tent_visits Users can insert own tent visits; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own tent visits" ON public.tent_visits FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: wrapped_data_cache Users can insert own wrapped cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own wrapped cache" ON public.wrapped_data_cache FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_achievements Users can insert their own achievements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own achievements" ON public.user_achievements FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_photo_global_settings Users can insert their own global photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own global photo settings" ON public.user_photo_global_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_group_photo_settings Users can insert their own group photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own group photo settings" ON public.user_group_photo_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_notification_preferences Users can insert their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own notification preferences" ON public.user_notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: group_members Users can join groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: group_members Users can leave groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: location_session_members Users can manage own session members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own session members" ON public.location_session_members USING ((session_id IN ( SELECT location_sessions.id
   FROM public.location_sessions
  WHERE (location_sessions.user_id = auth.uid()))));


--
-- Name: attendances Users can update own attendance; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own attendance" ON public.attendances FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: beer_pictures Users can update own beer pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own beer pictures" ON public.beer_pictures FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: consumptions Users can update own consumptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own consumptions" ON public.consumptions FOR UPDATE USING ((attendance_id IN ( SELECT attendances.id
   FROM public.attendances
  WHERE (attendances.user_id = auth.uid()))));


--
-- Name: location_sessions Users can update own location sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own location sessions" ON public.location_sessions FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: reservations Users can update own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own reservations" ON public.reservations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tent_visits Users can update own tent visits; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own tent visits" ON public.tent_visits FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: wrapped_data_cache Users can update own wrapped cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own wrapped cache" ON public.wrapped_data_cache FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_photo_global_settings Users can update their own global photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own global photo settings" ON public.user_photo_global_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_group_photo_settings Users can update their own group photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own group photo settings" ON public.user_group_photo_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_notification_preferences Users can update their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own notification preferences" ON public.user_notification_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: attendances Users can view activity feed from shared group members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view activity feed from shared group members" ON public.attendances FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.v_user_shared_group_members v
  WHERE ((v.owner_id = attendances.user_id) AND (v.viewer_id = auth.uid()) AND (v.festival_id = attendances.festival_id)))) OR (user_id = auth.uid())));


--
-- Name: group_members Users can view group memberships they are part of; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view group memberships they are part of" ON public.group_members FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: groups Users can view groups by invite token; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view groups by invite token" ON public.groups FOR SELECT USING ((invite_token IS NOT NULL));


--
-- Name: groups Users can view groups they are members of; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view groups they are members of" ON public.groups FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid())))));


--
-- Name: group_members Users can view other members in their groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view other members in their groups" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));


--
-- Name: attendances Users can view own and group members' attendance; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own and group members' attendance" ON public.attendances FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.group_members gm
     JOIN public.groups g ON ((gm.group_id = g.id)))
  WHERE ((g.festival_id = attendances.festival_id) AND (gm.user_id = auth.uid()))))));


--
-- Name: beer_pictures Users can view own beer pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own beer pictures" ON public.beer_pictures FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: consumptions Users can view own consumptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own consumptions" ON public.consumptions FOR SELECT USING ((attendance_id IN ( SELECT attendances.id
   FROM public.attendances
  WHERE (attendances.user_id = auth.uid()))));


--
-- Name: location_points Users can view own location points; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own location points" ON public.location_points FOR SELECT USING ((session_id IN ( SELECT location_sessions.id
   FROM public.location_sessions
  WHERE (location_sessions.user_id = auth.uid()))));


--
-- Name: location_sessions Users can view own location sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own location sessions" ON public.location_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: reservations Users can view own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own reservations" ON public.reservations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tent_visits Users can view own tent visits and group members' visits; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tent visits and group members' visits" ON public.tent_visits FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.v_user_shared_group_members v
  WHERE ((v.owner_id = tent_visits.user_id) AND (v.viewer_id = auth.uid()) AND (v.festival_id = tent_visits.festival_id))))));


--
-- Name: wrapped_data_cache Users can view own wrapped cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own wrapped cache" ON public.wrapped_data_cache FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: beer_pictures Users can view public beer pictures from group members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view public beer pictures from group members" ON public.beer_pictures FOR SELECT TO authenticated USING (((visibility = 'public'::public.photo_visibility_enum) AND (EXISTS ( SELECT 1
   FROM (public.attendances a
     JOIN public.v_user_shared_group_members v ON (((v.owner_id = beer_pictures.user_id) AND (v.festival_id = a.festival_id))))
  WHERE ((a.id = beer_pictures.attendance_id) AND (v.viewer_id = auth.uid()))))));


--
-- Name: achievement_events Users can view their own achievement_events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own achievement_events" ON public.achievement_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_achievements Users can view their own achievements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_photo_global_settings Users can view their own global photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own global photo settings" ON public.user_photo_global_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_group_photo_settings Users can view their own group photo settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own group photo settings" ON public.user_group_photo_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_notification_preferences Users can view their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own notification preferences" ON public.user_notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_rate_limit Users can view their own rate limit records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own rate limit records" ON public.notification_rate_limit FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: achievement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.achievement_events ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: attendances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: beer_pictures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.beer_pictures ENABLE ROW LEVEL SECURITY;

--
-- Name: consumptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;

--
-- Name: festival_tents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.festival_tents ENABLE ROW LEVEL SECURITY;

--
-- Name: festivals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: location_points; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.location_points ENABLE ROW LEVEL SECURITY;

--
-- Name: location_session_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.location_session_members ENABLE ROW LEVEL SECURITY;

--
-- Name: location_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_rate_limit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_rate_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tent_visits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tent_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: tents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tents ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_group_photo_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_group_photo_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_photo_global_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_photo_global_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: winning_criteria; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.winning_criteria ENABLE ROW LEVEL SECURITY;

--
-- Name: wrapped_data_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wrapped_data_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum) TO anon;
GRANT ALL ON FUNCTION public.add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum) TO authenticated;
GRANT ALL ON FUNCTION public.add_beer_picture(p_user_id uuid, p_attendance_id uuid, p_picture_url text, p_visibility public.photo_visibility_enum) TO service_role;


--
-- Name: FUNCTION add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.add_or_update_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_attendance_cost(p_attendance_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_attendance_cost(p_attendance_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_attendance_cost(p_attendance_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_attendance_cost(p_attendance_id uuid) TO service_role;


--
-- Name: FUNCTION check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_achievement_conditions(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer) TO anon;
GRANT ALL ON FUNCTION public.check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_notification_rate_limit(p_user_id uuid, p_notification_type text, p_group_id uuid, p_minutes_ago integer) TO service_role;


--
-- Name: FUNCTION cleanup_old_location_points(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_old_location_points() TO anon;
GRANT ALL ON FUNCTION public.cleanup_old_location_points() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_old_location_points() TO service_role;


--
-- Name: FUNCTION cleanup_old_rate_limit_records(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_old_rate_limit_records() TO anon;
GRANT ALL ON FUNCTION public.cleanup_old_rate_limit_records() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_old_rate_limit_records() TO service_role;


--
-- Name: FUNCTION create_default_notification_preferences(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO anon;
GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO authenticated;
GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO service_role;


--
-- Name: FUNCTION create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer, p_invite_token uuid, p_password character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer, p_invite_token uuid, p_password character varying) TO anon;
GRANT ALL ON FUNCTION public.create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer, p_invite_token uuid, p_password character varying) TO authenticated;
GRANT ALL ON FUNCTION public.create_group_with_member(p_group_name character varying, p_user_id uuid, p_festival_id uuid, p_winning_criteria_id integer, p_invite_token uuid, p_password character varying) TO service_role;


--
-- Name: FUNCTION delete_attendance(p_attendance_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.delete_attendance(p_attendance_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_attendance(p_attendance_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_attendance(p_attendance_id uuid) TO service_role;


--
-- Name: FUNCTION evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION evaluate_user_achievements(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.evaluate_user_achievements(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION expire_old_location_sessions(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expire_old_location_sessions() TO anon;
GRANT ALL ON FUNCTION public.expire_old_location_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.expire_old_location_sessions() TO service_role;


--
-- Name: FUNCTION expire_old_locations(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expire_old_locations() TO anon;
GRANT ALL ON FUNCTION public.expire_old_locations() TO authenticated;
GRANT ALL ON FUNCTION public.expire_old_locations() TO service_role;


--
-- Name: FUNCTION fetch_group_gallery(p_group_id uuid, p_festival_id uuid, p_viewing_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fetch_group_gallery(p_group_id uuid, p_festival_id uuid, p_viewing_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fetch_group_gallery(p_group_id uuid, p_festival_id uuid, p_viewing_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fetch_group_gallery(p_group_id uuid, p_festival_id uuid, p_viewing_user_id uuid) TO service_role;


--
-- Name: FUNCTION generate_group_token(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_group_token() TO anon;
GRANT ALL ON FUNCTION public.generate_group_token() TO authenticated;
GRANT ALL ON FUNCTION public.generate_group_token() TO service_role;
GRANT ALL ON FUNCTION public.generate_group_token() TO super_admin;


--
-- Name: FUNCTION get_achievement_leaderboard(p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_achievement_leaderboard(p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_achievement_leaderboard(p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_achievement_leaderboard(p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_festival_beer_cost(p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_festival_beer_cost(p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_festival_beer_cost(p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_festival_beer_cost(p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_global_leaderboard(p_winning_criteria_id integer, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_group_achievement_recipients(p_user_ids uuid[], p_festival_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer) TO service_role;


--
-- Name: FUNCTION get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer) TO anon;
GRANT ALL ON FUNCTION public.get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_nearby_group_members(input_user_id uuid, input_festival_id uuid, radius_meters integer) TO service_role;


--
-- Name: FUNCTION get_user_achievements(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_achievements(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_all_group_photo_settings(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_all_group_photo_settings(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_all_group_photo_settings(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_all_group_photo_settings(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_festival_stats(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_festival_stats(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_festival_stats(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_festival_stats(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_group_photo_settings(p_user_id uuid, p_group_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_group_photo_settings(p_user_id uuid, p_group_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_group_photo_settings(p_user_id uuid, p_group_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_group_photo_settings(p_user_id uuid, p_group_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_groups(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_groups() TO anon;
GRANT ALL ON FUNCTION public.get_user_groups() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_groups() TO service_role;
GRANT ALL ON FUNCTION public.get_user_groups() TO super_admin;


--
-- Name: FUNCTION get_user_photo_global_settings(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_photo_global_settings(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_photo_global_settings(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_photo_global_settings(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_stats(input_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_stats(input_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_stats(input_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_stats(input_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_stats(input_user_id uuid) TO super_admin;


--
-- Name: FUNCTION get_wrapped_data(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO super_admin;


--
-- Name: FUNCTION insert_achievement_event_from_unlock(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.insert_achievement_event_from_unlock() TO anon;
GRANT ALL ON FUNCTION public.insert_achievement_event_from_unlock() TO authenticated;
GRANT ALL ON FUNCTION public.insert_achievement_event_from_unlock() TO service_role;


--
-- Name: FUNCTION invalidate_festival_wrapped_cache(p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invalidate_festival_wrapped_cache(p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.invalidate_festival_wrapped_cache(p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invalidate_festival_wrapped_cache(p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invalidate_wrapped_cache(p_user_id uuid, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION is_group_member(group_id uuid, user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_group_member(group_id uuid, user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_group_member(group_id uuid, user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_group_member(group_id uuid, user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_group_member(group_id uuid, user_id uuid) TO super_admin;


--
-- Name: FUNCTION is_super_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_super_admin() TO anon;
GRANT ALL ON FUNCTION public.is_super_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin() TO service_role;


--
-- Name: FUNCTION join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying, p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION join_group_with_token(p_user_id uuid, p_token uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid) TO anon;
GRANT ALL ON FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid) TO service_role;


--
-- Name: FUNCTION record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text) TO anon;
GRANT ALL ON FUNCTION public.record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text) TO authenticated;
GRANT ALL ON FUNCTION public.record_notification_rate_limit(p_user_id uuid, p_group_id uuid, p_notification_type text) TO service_role;


--
-- Name: FUNCTION regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regenerate_wrapped_data_cache(p_user_id uuid, p_festival_id uuid, p_admin_user_id uuid) TO service_role;


--
-- Name: FUNCTION renew_group_token(p_group_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.renew_group_token(p_group_id uuid) TO anon;
GRANT ALL ON FUNCTION public.renew_group_token(p_group_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.renew_group_token(p_group_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.renew_group_token(p_group_id uuid) TO super_admin;


--
-- Name: FUNCTION rpc_due_reservation_prompts(p_now timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone) TO service_role;


--
-- Name: FUNCTION rpc_due_reservation_reminders(p_now timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone) TO service_role;


--
-- Name: FUNCTION trigger_achievement_cache_invalidation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_achievement_cache_invalidation() TO anon;
GRANT ALL ON FUNCTION public.trigger_achievement_cache_invalidation() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_achievement_cache_invalidation() TO service_role;


--
-- Name: FUNCTION trigger_evaluate_achievements(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_evaluate_achievements() TO anon;
GRANT ALL ON FUNCTION public.trigger_evaluate_achievements() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_evaluate_achievements() TO service_role;


--
-- Name: FUNCTION trigger_tent_visit_cache_invalidation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_tent_visit_cache_invalidation() TO anon;
GRANT ALL ON FUNCTION public.trigger_tent_visit_cache_invalidation() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_tent_visit_cache_invalidation() TO service_role;


--
-- Name: FUNCTION trigger_wrapped_cache_invalidation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_wrapped_cache_invalidation() TO anon;
GRANT ALL ON FUNCTION public.trigger_wrapped_cache_invalidation() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_wrapped_cache_invalidation() TO service_role;


--
-- Name: FUNCTION unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) TO anon;
GRANT ALL ON FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.unlock_achievement(p_user_id uuid, p_festival_id uuid, p_achievement_id uuid) TO service_role;


--
-- Name: FUNCTION update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_personal_attendance_with_tents(p_user_id uuid, p_date timestamp with time zone, p_beer_count integer, p_tent_ids uuid[], p_festival_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO super_admin;


--
-- Name: FUNCTION update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean) TO anon;
GRANT ALL ON FUNCTION public.update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_group_photo_settings(p_user_id uuid, p_group_id uuid, p_hide_photos_from_group boolean) TO service_role;


--
-- Name: FUNCTION update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean) TO anon;
GRANT ALL ON FUNCTION public.update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_photo_global_settings(p_user_id uuid, p_hide_photos_from_all_groups boolean) TO service_role;


--
-- Name: FUNCTION update_wrapped_data_cache_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_wrapped_data_cache_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_wrapped_data_cache_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_wrapped_data_cache_updated_at() TO service_role;


--
-- Name: FUNCTION upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) TO anon;
GRANT ALL ON FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_attendance_record(p_user_id uuid, p_date date, p_beer_count integer, p_festival_id uuid) TO service_role;


--
-- Name: TABLE achievement_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievement_events TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievement_events TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievement_events TO service_role;


--
-- Name: TABLE achievements; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievements TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievements TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.achievements TO service_role;


--
-- Name: TABLE attendances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendances TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendances TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendances TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendances TO super_admin;


--
-- Name: TABLE beer_pictures; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.beer_pictures TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.beer_pictures TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.beer_pictures TO service_role;


--
-- Name: TABLE consumptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.consumptions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.consumptions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.consumptions TO service_role;


--
-- Name: TABLE group_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.group_members TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.group_members TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.group_members TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.group_members TO super_admin;


--
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.groups TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.groups TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.groups TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.groups TO super_admin;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO super_admin;


--
-- Name: TABLE tent_visits; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tent_visits TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tent_visits TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tent_visits TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tent_visits TO super_admin;


--
-- Name: TABLE tents; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tents TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tents TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tents TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.tents TO super_admin;


--
-- Name: TABLE user_achievements; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_achievements TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_achievements TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_achievements TO service_role;


--
-- Name: TABLE activity_feed; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.activity_feed TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.activity_feed TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.activity_feed TO service_role;


--
-- Name: TABLE attendance_with_totals; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendance_with_totals TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendance_with_totals TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.attendance_with_totals TO service_role;


--
-- Name: TABLE festival_tents; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festival_tents TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festival_tents TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festival_tents TO service_role;


--
-- Name: TABLE festivals; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festivals TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festivals TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.festivals TO service_role;


--
-- Name: TABLE leaderboard; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leaderboard TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leaderboard TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leaderboard TO service_role;


--
-- Name: TABLE location_points; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_points TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_points TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_points TO service_role;


--
-- Name: TABLE location_session_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_session_members TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_session_members TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_session_members TO service_role;


--
-- Name: TABLE location_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_sessions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_sessions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.location_sessions TO service_role;


--
-- Name: TABLE notification_rate_limit; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.notification_rate_limit TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.notification_rate_limit TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.notification_rate_limit TO service_role;


--
-- Name: TABLE reservations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.reservations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.reservations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.reservations TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.system_settings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.system_settings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE user_group_photo_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_group_photo_settings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_group_photo_settings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_group_photo_settings TO service_role;


--
-- Name: TABLE user_notification_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_notification_preferences TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_notification_preferences TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_notification_preferences TO service_role;


--
-- Name: TABLE user_photo_global_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_photo_global_settings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_photo_global_settings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_photo_global_settings TO service_role;


--
-- Name: TABLE v_user_shared_group_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.v_user_shared_group_members TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.v_user_shared_group_members TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.v_user_shared_group_members TO service_role;


--
-- Name: TABLE winning_criteria; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.winning_criteria TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.winning_criteria TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.winning_criteria TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.winning_criteria TO super_admin;


--
-- Name: SEQUENCE winning_criteria_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.winning_criteria_id_seq TO anon;
GRANT ALL ON SEQUENCE public.winning_criteria_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.winning_criteria_id_seq TO service_role;
GRANT ALL ON SEQUENCE public.winning_criteria_id_seq TO super_admin;


--
-- Name: TABLE wrapped_data_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.wrapped_data_cache TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.wrapped_data_cache TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.wrapped_data_cache TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict DlBhWi9SJyObQUTF2pn09KZfUBhGsN8VSKBvvddFLNmkUL3KX1lXbvM0XhGTnjp

