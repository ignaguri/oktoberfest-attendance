-- Achievements System Schema
-- This migration creates the complete achievement system schema with tables, functions, triggers, and policies

-- Create enums for achievement system
CREATE TYPE achievement_category_enum AS ENUM (
  'consumption',
  'attendance', 
  'explorer',
  'social',
  'competitive',
  'special'
);

CREATE TYPE achievement_rarity_enum AS ENUM (
  'common',
  'rare', 
  'epic',
  'legendary'
);

-- Create achievements table
CREATE TABLE achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  category achievement_category_enum NOT NULL,
  icon text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  rarity achievement_rarity_enum NOT NULL DEFAULT 'common',
  conditions jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  progress jsonb NULL,
  UNIQUE(user_id, achievement_id, festival_id)
);

-- Add indexes for performance
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_rarity ON achievements(rarity);
CREATE INDEX idx_achievements_active ON achievements(is_active);
CREATE INDEX idx_user_achievements_user_festival ON user_achievements(user_id, festival_id);
CREATE INDEX idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_festival ON user_achievements(festival_id);

-- Add updated_at trigger for achievements
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_achievements_updated_at 
  BEFORE UPDATE ON achievements 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to calculate current progress for any achievement
CREATE OR REPLACE FUNCTION calculate_achievement_progress(
  p_user_id uuid,
  p_festival_id uuid,
  p_achievement_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  achievement_record achievements;
  conditions jsonb;
  achievement_type text;
  target_value integer;
  current_value integer;
  comparison_op text;
  result jsonb;
BEGIN
  -- Get the achievement record
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
  
  -- Initialize current_value
  current_value := 0;
  
  -- Calculate current progress based on achievement type
  CASE achievement_type
    WHEN 'threshold' THEN
      -- Handle threshold-based achievements
      CASE achievement_record.category
        WHEN 'consumption' THEN
          -- Check if this is a single-day achievement or festival total
          IF achievement_record.name LIKE '%single day%' OR achievement_record.name LIKE '%Daily%' OR achievement_record.name LIKE '%Power%' OR achievement_record.name LIKE '%Session%' THEN
            -- Single day maximum
            SELECT COALESCE(MAX(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          ELSIF achievement_record.name LIKE '%across all festivals%' OR achievement_record.name LIKE '%Legend Status%' THEN
            -- Across all festivals
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSE
            -- Festival total
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;
          
        WHEN 'attendance' THEN
          -- Days attended in this festival
          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;
          
        WHEN 'social' THEN
          -- Social achievements (groups joined, photos uploaded)
          IF achievement_record.name LIKE '%group%' OR achievement_record.name LIKE '%Group%' THEN
            IF achievement_record.name LIKE '%Leader%' OR achievement_record.name LIKE '%Create%' THEN
              -- Groups created
              SELECT COUNT(*) INTO current_value
              FROM groups
              WHERE created_by = p_user_id AND festival_id = p_festival_id;
            ELSE
              -- Groups joined
              SELECT COUNT(DISTINCT g.id) INTO current_value
              FROM group_members gm
              JOIN groups g ON gm.group_id = g.id
              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
            END IF;
          ELSIF achievement_record.name LIKE '%Photo%' THEN
            -- Photos uploaded
            SELECT COUNT(*) INTO current_value
            FROM beer_pictures bp
            JOIN attendances a ON bp.attendance_id = a.id
            WHERE bp.user_id = p_user_id AND a.festival_id = p_festival_id;
          END IF;
          
        WHEN 'explorer' THEN
          -- Tent visits
          SELECT COUNT(DISTINCT tent_id) INTO current_value
          FROM tent_visits
          WHERE user_id = p_user_id AND festival_id = p_festival_id;
          
        WHEN 'competitive' THEN
          -- Competitive achievements (simplified)
          SELECT COUNT(*) INTO current_value
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
          
        WHEN 'special' THEN
          -- Special achievements
          IF achievement_record.name = 'Festival Veteran' THEN
            SELECT COUNT(DISTINCT festival_id) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSIF achievement_record.name = 'High Roller' THEN
            -- Total spent calculation
            SELECT COALESCE(SUM(
              beer_count * COALESCE(
                (SELECT custom_beer_cost FROM profiles WHERE id = p_user_id),
                16.2
              )
            ), 0)::integer INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;
      END CASE;
      
    WHEN 'variety' THEN
      -- Tent variety achievements
      SELECT COUNT(DISTINCT tent_id) INTO current_value
      FROM tent_visits
      WHERE user_id = p_user_id AND festival_id = p_festival_id;
      
    WHEN 'streak' THEN
      -- Streak achievements - calculate max streak
      DECLARE
        min_days integer := (conditions->>'min_days')::integer;
        max_streak integer := 0;
        current_streak integer := 0;
        prev_date date := null;
        attendance_date date;
      BEGIN
        FOR attendance_date IN 
          SELECT DISTINCT date::date
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id
          ORDER BY date::date
        LOOP
          IF prev_date IS NULL OR attendance_date = prev_date + INTERVAL '1 day' THEN
            current_streak := current_streak + 1;
            max_streak := GREATEST(max_streak, current_streak);
          ELSE
            current_streak := 1;
          END IF;
          prev_date := attendance_date;
        END LOOP;
        
        current_value := max_streak;
        target_value := min_days;
      END;
      
    WHEN 'special' THEN
      -- Handle special achievements with different progress calculations
      CASE achievement_record.name
        WHEN 'Festival Warrior' THEN
          -- Perfect attendance - days attended vs total festival days
          DECLARE
            festival_days integer;
          BEGIN
            SELECT (end_date::date - start_date::date + 1) INTO festival_days
            FROM festivals WHERE id = p_festival_id;
            
            SELECT COUNT(DISTINCT date::date) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
            
            target_value := festival_days;
          END;
          
        WHEN 'Weekend Warrior' THEN
          -- Weekend attendance
          DECLARE
            weekend_days integer;
          BEGIN
            SELECT COUNT(*) INTO weekend_days
            FROM generate_series(
              (SELECT start_date::date FROM festivals WHERE id = p_festival_id),
              (SELECT end_date::date FROM festivals WHERE id = p_festival_id),
              '1 day'::interval
            ) AS festival_date
            WHERE EXTRACT(DOW FROM festival_date) IN (0, 6);
            
            SELECT COUNT(DISTINCT date::date) INTO current_value
            FROM attendances a
            WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
            AND EXTRACT(DOW FROM a.date::date) IN (0, 6);
            
            target_value := weekend_days;
          END;
          
        ELSE
          -- For other special achievements, use binary progress
          current_value := CASE WHEN check_achievement_conditions(p_user_id, p_festival_id, p_achievement_id) THEN 1 ELSE 0 END;
          target_value := 1;
      END CASE;
  END CASE;
  
  -- Ensure we have a target_value
  target_value := COALESCE(target_value, 1);
  
  -- Calculate percentage
  result := jsonb_build_object(
    'current_value', current_value,
    'target_value', target_value,
    'percentage', CASE 
      WHEN target_value > 0 THEN LEAST(100, ROUND((current_value::float / target_value::float) * 100))
      ELSE 0 
    END
  );
  
  RETURN result;
END;
$$;

-- Function to check if specific achievement conditions are met
CREATE OR REPLACE FUNCTION check_achievement_conditions(
  p_user_id uuid,
  p_festival_id uuid,
  p_achievement_id uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  achievement_record achievements;
  conditions jsonb;
  achievement_type text;
  target_value integer;
  current_value integer;
  comparison_op text;
BEGIN
  -- Get the achievement record
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
  
  -- Initialize current_value
  current_value := 0;
  
  -- Calculate current progress based on achievement type and category
  CASE achievement_type
    WHEN 'threshold' THEN
      CASE achievement_record.category
        WHEN 'consumption' THEN
          -- Check if this is a single-day achievement or festival total
          IF achievement_record.name LIKE '%single day%' OR achievement_record.name LIKE '%Daily%' OR achievement_record.name LIKE '%Power%' OR achievement_record.name LIKE '%Session%' THEN
            -- Single day maximum
            SELECT COALESCE(MAX(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          ELSIF achievement_record.name LIKE '%across all festivals%' OR achievement_record.name LIKE '%Legend Status%' THEN
            -- Across all festivals
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id;
          ELSE
            -- Festival total
            SELECT COALESCE(SUM(beer_count), 0) INTO current_value
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
          END IF;
          
        WHEN 'attendance' THEN
          -- Days attended in this festival
          SELECT COUNT(DISTINCT date) INTO current_value
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id;
          
        WHEN 'social' THEN
          -- Social achievements (groups joined, photos uploaded)
          IF achievement_record.name LIKE '%group%' OR achievement_record.name LIKE '%Group%' THEN
            IF achievement_record.name LIKE '%Leader%' OR achievement_record.name LIKE '%Create%' THEN
              -- Groups created
              SELECT COUNT(*) INTO current_value
              FROM groups
              WHERE created_by = p_user_id AND festival_id = p_festival_id;
            ELSE
              -- Groups joined
              SELECT COUNT(DISTINCT g.id) INTO current_value
              FROM group_members gm
              JOIN groups g ON gm.group_id = g.id
              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
            END IF;
          ELSIF achievement_record.name LIKE '%Photo%' THEN
            -- Photos uploaded
            SELECT COUNT(*) INTO current_value
            FROM beer_pictures bp
            JOIN attendances a ON bp.attendance_id = a.id
            WHERE bp.user_id = p_user_id AND a.festival_id = p_festival_id;
          END IF;
          
        WHEN 'explorer' THEN
          -- Tent visits
          SELECT COUNT(DISTINCT tent_id) INTO current_value
          FROM tent_visits
          WHERE user_id = p_user_id AND festival_id = p_festival_id;
          
        WHEN 'competitive' THEN
          -- Competitive achievements (simplified for now)
          SELECT COUNT(*) INTO current_value
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id;
          
        WHEN 'special' THEN
          -- Special achievements require custom logic
          CASE achievement_record.name
            WHEN 'Festival Veteran' THEN
              SELECT COUNT(DISTINCT festival_id) INTO current_value
              FROM attendances
              WHERE user_id = p_user_id;
              
            WHEN 'High Roller' THEN
              SELECT COALESCE(SUM(
                beer_count * COALESCE(
                  (SELECT custom_beer_cost FROM profiles WHERE id = p_user_id),
                  16.2
                )
              ), 0)::integer INTO current_value
              FROM attendances
              WHERE user_id = p_user_id AND festival_id = p_festival_id;
              
            ELSE
              RETURN false; -- Will handle other special cases individually
          END CASE;
      END CASE;
      
    WHEN 'variety' THEN
      -- Tent variety achievements
      SELECT COUNT(DISTINCT tent_id) INTO current_value
      FROM tent_visits
      WHERE user_id = p_user_id AND festival_id = p_festival_id;
      
    WHEN 'streak' THEN
      -- Streak achievements - calculate max consecutive days
      DECLARE
        min_days integer := (conditions->>'min_days')::integer;
        max_streak integer := 0;
        current_streak integer := 0;
        prev_date date := null;
        attendance_date date;
      BEGIN
        FOR attendance_date IN 
          SELECT DISTINCT date::date
          FROM attendances
          WHERE user_id = p_user_id AND festival_id = p_festival_id
          ORDER BY date::date
        LOOP
          IF prev_date IS NULL OR attendance_date = prev_date + INTERVAL '1 day' THEN
            current_streak := current_streak + 1;
            max_streak := GREATEST(max_streak, current_streak);
          ELSE
            current_streak := 1;
          END IF;
          prev_date := attendance_date;
        END LOOP;
        
        current_value := max_streak;
        target_value := min_days;
      END;
      
    WHEN 'special' THEN
      -- Handle special achievements that require custom conditions
      CASE achievement_record.name
        WHEN 'Festival Warrior' THEN
          -- Perfect attendance
          DECLARE
            festival_days integer;
            days_attended integer;
          BEGIN
            SELECT (end_date::date - start_date::date + 1) INTO festival_days
            FROM festivals WHERE id = p_festival_id;
            
            SELECT COUNT(DISTINCT date::date) INTO days_attended
            FROM attendances
            WHERE user_id = p_user_id AND festival_id = p_festival_id;
            
            RETURN days_attended = festival_days;
          END;
          
        WHEN 'Weekend Warrior' THEN
          -- All weekends attended
          DECLARE
            weekend_days integer;
            weekend_attended integer;
          BEGIN
            SELECT COUNT(*) INTO weekend_days
            FROM generate_series(
              (SELECT start_date::date FROM festivals WHERE id = p_festival_id),
              (SELECT end_date::date FROM festivals WHERE id = p_festival_id),
              '1 day'::interval
            ) AS festival_date
            WHERE EXTRACT(DOW FROM festival_date) IN (0, 6);
            
            SELECT COUNT(DISTINCT date::date) INTO weekend_attended
            FROM attendances a
            WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
            AND EXTRACT(DOW FROM a.date::date) IN (0, 6);
            
            RETURN weekend_attended = weekend_days;
          END;
          
        WHEN 'Early Bird' THEN
          -- First day attendance
          RETURN EXISTS (
            SELECT 1 FROM attendances a
            JOIN festivals f ON a.festival_id = f.id
            WHERE a.user_id = p_user_id 
            AND a.festival_id = p_festival_id
            AND a.date::date = f.start_date::date
          );
          
        ELSE
          RETURN false; -- Handle other special achievements later
      END CASE;
      
    ELSE
      RETURN false;
  END CASE;
  
  -- Apply comparison operator
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
      RETURN current_value >= target_value; -- Default to gte
  END CASE;
END;
$$;

-- Function to get user achievements with progress
CREATE OR REPLACE FUNCTION get_user_achievements(
  p_user_id uuid,
  p_festival_id uuid
) RETURNS TABLE(
  achievement_id uuid,
  name text,
  description text,
  category achievement_category_enum,
  icon text,
  points integer,
  rarity achievement_rarity_enum,
  is_unlocked boolean,
  unlocked_at timestamptz,
  current_progress jsonb
)
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
    calculate_achievement_progress(p_user_id, p_festival_id, a.id) as current_progress
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

-- Function to unlock an achievement for a user
CREATE OR REPLACE FUNCTION unlock_achievement(
  p_user_id uuid,
  p_festival_id uuid,
  p_achievement_id uuid
) RETURNS boolean
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

-- Function to evaluate all achievements for a user
CREATE OR REPLACE FUNCTION evaluate_user_achievements(
  p_user_id uuid,
  p_festival_id uuid
) RETURNS void
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
    IF check_achievement_conditions(p_user_id, p_festival_id, achievement_rec.id) THEN
      -- Try to unlock the achievement
      SELECT unlock_achievement(p_user_id, p_festival_id, achievement_rec.id) INTO unlocked;
    END IF;
  END LOOP;
END;
$$;

-- Function to get achievement leaderboard for a festival
CREATE OR REPLACE FUNCTION get_achievement_leaderboard(
  p_festival_id uuid
) RETURNS TABLE(
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  total_achievements bigint,
  total_points bigint
)
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

-- Create trigger function to automatically evaluate achievements
CREATE OR REPLACE FUNCTION trigger_evaluate_achievements()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Set up triggers to auto-evaluate achievements
CREATE TRIGGER achievements_on_attendance_change
  AFTER INSERT OR UPDATE OR DELETE ON attendances
  FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_achievements();

CREATE TRIGGER achievements_on_tent_visit_change
  AFTER INSERT OR UPDATE OR DELETE ON tent_visits
  FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_achievements();

CREATE TRIGGER achievements_on_beer_picture_change
  AFTER INSERT OR UPDATE OR DELETE ON beer_pictures
  FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_achievements();

CREATE TRIGGER achievements_on_group_member_change
  AFTER INSERT OR UPDATE OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_achievements();

-- Enable RLS on tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS policies for achievements (readable by everyone)
CREATE POLICY "Achievements are viewable by everyone" ON achievements
  FOR SELECT USING (true);

CREATE POLICY "Only super admins can modify achievements" ON achievements
  FOR ALL USING (is_super_admin());

-- RLS policies for user_achievements
CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all user achievements" ON user_achievements
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admins can modify user achievements" ON user_achievements
  FOR ALL USING (is_super_admin());

-- Add comments
COMMENT ON TABLE achievements IS 'Core achievement definitions and metadata';
COMMENT ON TABLE user_achievements IS 'User-specific achievement unlocks per festival';
COMMENT ON FUNCTION check_achievement_conditions IS 'Evaluates if specific achievement conditions are met for a user';
COMMENT ON FUNCTION unlock_achievement IS 'Unlocks an achievement for a user if not already unlocked';
COMMENT ON FUNCTION evaluate_user_achievements IS 'Evaluates all achievements for a user and unlocks eligible ones';
COMMENT ON FUNCTION calculate_achievement_progress IS 'Calculates current progress for any achievement, returning current_value, target_value, and percentage';
COMMENT ON FUNCTION get_user_achievements IS 'Returns all achievements with progress data for a user in a specific festival';