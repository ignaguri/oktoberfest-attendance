-- Create a new table for beer pictures
CREATE TABLE public.beer_pictures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    attendance_id UUID NOT NULL REFERENCES public.attendances(id),
    picture_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_beer_pictures_user_id ON public.beer_pictures(user_id);
CREATE INDEX idx_beer_pictures_attendance_id ON public.beer_pictures(attendance_id);

DROP FUNCTION IF EXISTS public.add_or_update_attendance_with_tents(uuid, date, integer, uuid[]);
DROP FUNCTION IF EXISTS public.add_or_update_attendance_with_tents(uuid, timestamp with time zone, integer, uuid[]);
-- Update the add_or_update_attendance_with_tents function
CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents(
    p_user_id UUID,
    p_date TIMESTAMPTZ,
    p_beer_count INTEGER,
    p_tent_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
BEGIN
    -- Insert or update the attendance record
    INSERT INTO attendances (user_id, date, beer_count)
    VALUES (p_user_id, p_date::date, p_beer_count)
    ON CONFLICT (user_id, date)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- Delete existing tent visits for this user and date
    DELETE FROM tent_visits
    WHERE user_id = p_user_id AND visit_date::date = p_date::date;

    -- Insert new tent visits with manually generated UUIDs
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
        VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
    END LOOP;

    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to add a beer picture
CREATE OR REPLACE FUNCTION add_beer_picture(
    p_user_id UUID,
    p_attendance_id UUID,
    p_picture_url TEXT
)
RETURNS UUID AS $$
DECLARE
    v_picture_id UUID;
BEGIN
    INSERT INTO beer_pictures (user_id, attendance_id, picture_url)
    VALUES (p_user_id, p_attendance_id, p_picture_url)
    RETURNING id INTO v_picture_id;

    RETURN v_picture_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fetch_group_gallery(p_group_id UUID)
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
  WHERE
    gm.group_id = p_group_id
  GROUP BY
    a.date, bp.user_id, p.username, p.full_name
  ORDER BY
    a.date ASC, bp.user_id;
END;
$$;