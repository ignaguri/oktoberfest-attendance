-- Migration: Drop custom_beer_cost column from profiles table
-- This column is no longer needed as beer cost is now determined by festival settings

-- First, drop the achievement functions that reference custom_beer_cost
-- They will be recreated without the custom_beer_cost reference
DROP FUNCTION IF EXISTS evaluate_achievement_progress(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS calculate_achievement_progress(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS check_achievement_conditions(uuid, uuid, uuid);

-- Create a helper function to get beer cost for a festival
CREATE OR REPLACE FUNCTION get_festival_beer_cost(p_festival_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
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

-- Recreate evaluate_achievement_progress without custom_beer_cost
CREATE OR REPLACE FUNCTION evaluate_achievement_progress(p_user_id uuid, p_achievement_id uuid, p_festival_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Recreate calculate_achievement_progress without custom_beer_cost
CREATE OR REPLACE FUNCTION calculate_achievement_progress(
  p_user_id uuid,
  p_achievement_id uuid,
  p_festival_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Recreate check_achievement_conditions without custom_beer_cost
CREATE OR REPLACE FUNCTION check_achievement_conditions(
  p_user_id uuid,
  p_achievement_id uuid,
  p_festival_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Now drop the custom_beer_cost column
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_beer_cost;
