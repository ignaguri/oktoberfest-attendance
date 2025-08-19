-- Multi-Festival Support Migration
-- Phase 3: Update functions and RLS policies to be festival-aware

-- Update the add_or_update_attendance_with_tents function to be festival-aware
DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(uuid, date, integer, uuid[]);
DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(uuid, timestamp with time zone, integer, uuid[]);

CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents(
  p_user_id UUID,
  p_festival_id UUID,
  p_date DATE,
  p_beer_count INTEGER,
  p_tent_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_tent_id UUID;
  v_attendance_id UUID;
BEGIN
  -- Insert or update the attendance record
  INSERT INTO attendances (user_id, festival_id, date, beer_count)
  VALUES (p_user_id, p_festival_id, p_date, p_beer_count)
  ON CONFLICT (user_id, date, festival_id)
  DO UPDATE SET beer_count = p_beer_count
  RETURNING id INTO v_attendance_id;

  -- Delete existing tent visits for this user, festival and date
  DELETE FROM tent_visits
  WHERE user_id = p_user_id 
    AND festival_id = p_festival_id 
    AND visit_date::date = p_date;

  -- Insert new tent visits
  FOREACH v_tent_id IN ARRAY p_tent_ids
  LOOP
    INSERT INTO tent_visits (id, user_id, festival_id, tent_id, visit_date)
    VALUES (uuid_generate_v4(), p_user_id, p_festival_id, v_tent_id, p_date);
  END LOOP;

  RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate attendance cost based on tent visits and festival pricing
CREATE OR REPLACE FUNCTION calculate_attendance_cost(
  p_attendance_id UUID
) RETURNS DECIMAL(10,2) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get user statistics for a specific festival
CREATE OR REPLACE FUNCTION get_user_festival_stats(
  p_user_id UUID,
  p_festival_id UUID
) RETURNS TABLE (
  total_beers BIGINT,
  days_attended BIGINT,
  avg_beers DECIMAL(5,2),
  total_spent DECIMAL(10,2),
  favorite_tent VARCHAR,
  most_expensive_day DECIMAL(8,2)
) AS $$
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
$$ LANGUAGE plpgsql;

-- Update group gallery function to be festival-aware
DROP FUNCTION IF EXISTS public.fetch_group_gallery(uuid);

CREATE OR REPLACE FUNCTION public.fetch_group_gallery(
  p_group_id UUID,
  p_festival_id UUID DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  picture_data JSONB
) LANGUAGE plpgsql AS $$
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
        'uploadedAt', bp.created_at
      ) ORDER BY bp.created_at DESC
    ) AS picture_data
  FROM
    beer_pictures bp
    INNER JOIN attendances a ON bp.attendance_id = a.id
    INNER JOIN profiles p ON bp.user_id = p.id
    INNER JOIN group_members gm ON bp.user_id = gm.user_id
    INNER JOIN groups g ON gm.group_id = g.id
  WHERE
    gm.group_id = p_group_id
    AND (p_festival_id IS NULL OR a.festival_id = p_festival_id)
  GROUP BY
    a.date, bp.user_id, p.username, p.full_name
  ORDER BY
    a.date ASC, bp.user_id;
END;
$$;

-- Update RLS policies to be festival-aware
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own and group members' attendance" ON attendances;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;

-- Create new festival-aware policies for attendances
CREATE POLICY "Users can view own and group members' attendance"
  ON attendances FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM group_members gm 
      JOIN groups g ON gm.group_id = g.id 
      WHERE g.festival_id = attendances.festival_id 
        AND gm.user_id = auth.uid()
    )
  );

-- Create new festival-aware policies for groups
CREATE POLICY "Users can view groups they are members of"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id 
        AND group_members.user_id = auth.uid()
    )
  );

-- Update tent_visits policies to be festival-aware
CREATE POLICY "Users can view own tent visits and group members' visits"
  ON tent_visits FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      WHERE g.festival_id = tent_visits.festival_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tent visits"
  ON tent_visits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tent visits"
  ON tent_visits FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tent visits"
  ON tent_visits FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());