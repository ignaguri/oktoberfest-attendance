-- Create photo visibility enum
CREATE TYPE photo_visibility_enum AS ENUM ('public', 'private');

-- Add visibility column to beer_pictures table
ALTER TABLE public.beer_pictures 
ADD COLUMN visibility photo_visibility_enum NOT NULL DEFAULT 'public';

-- Create index for better query performance on visibility
CREATE INDEX idx_beer_pictures_visibility ON public.beer_pictures(visibility);

-- Create table for user's global photo sharing preferences
CREATE TABLE public.user_photo_global_settings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hide_photos_from_all_groups BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for global settings
CREATE INDEX idx_user_photo_global_settings_user_id ON public.user_photo_global_settings(user_id);

-- Create table for user's per-group photo sharing preferences
CREATE TABLE public.user_group_photo_settings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    hide_photos_from_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

-- Create indexes for per-group settings
CREATE INDEX idx_user_group_photo_settings_user_id ON public.user_group_photo_settings(user_id);
CREATE INDEX idx_user_group_photo_settings_group_id ON public.user_group_photo_settings(group_id);
CREATE INDEX idx_user_group_photo_settings_user_group ON public.user_group_photo_settings(user_id, group_id);

-- Enable RLS on new tables
ALTER TABLE public.user_photo_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_photo_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_photo_global_settings
CREATE POLICY "Users can view their own global photo settings"
ON public.user_photo_global_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own global photo settings"
ON public.user_photo_global_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own global photo settings"
ON public.user_photo_global_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own global photo settings"
ON public.user_photo_global_settings FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_group_photo_settings
CREATE POLICY "Users can view their own group photo settings"
ON public.user_group_photo_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own group photo settings"
ON public.user_group_photo_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own group photo settings"
ON public.user_group_photo_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own group photo settings"
ON public.user_group_photo_settings FOR DELETE
USING (auth.uid() = user_id);

-- Update the add_beer_picture function to handle visibility
DROP FUNCTION IF EXISTS public.add_beer_picture(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.add_beer_picture(
    p_user_id UUID,
    p_attendance_id UUID,
    p_picture_url TEXT,
    p_visibility photo_visibility_enum DEFAULT 'public'
)
RETURNS UUID AS $$
DECLARE
    v_picture_id UUID;
BEGIN
    INSERT INTO beer_pictures (user_id, attendance_id, picture_url, visibility)
    VALUES (p_user_id, p_attendance_id, p_picture_url, p_visibility)
    RETURNING id INTO v_picture_id;

    RETURN v_picture_id;
END;
$$ LANGUAGE plpgsql;

-- Update fetch_group_gallery function to respect visibility settings
DROP FUNCTION IF EXISTS public.fetch_group_gallery(UUID);
DROP FUNCTION IF EXISTS public.fetch_group_gallery(UUID, UUID);

CREATE OR REPLACE FUNCTION public.fetch_group_gallery(
    p_group_id UUID,
    p_festival_id UUID DEFAULT NULL,
    p_viewing_user_id UUID DEFAULT auth.uid()
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

-- Function to get user's global photo settings (creates default if not exists)
CREATE OR REPLACE FUNCTION public.get_user_photo_global_settings(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    hide_photos_from_all_groups BOOLEAN
) LANGUAGE plpgsql AS $$
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

-- Function to update user's global photo settings
CREATE OR REPLACE FUNCTION public.update_user_photo_global_settings(
    p_user_id UUID,
    p_hide_photos_from_all_groups BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_photo_global_settings (user_id, hide_photos_from_all_groups, updated_at)
    VALUES (p_user_id, p_hide_photos_from_all_groups, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        hide_photos_from_all_groups = p_hide_photos_from_all_groups,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user's group-specific photo settings
CREATE OR REPLACE FUNCTION public.get_user_group_photo_settings(
    p_user_id UUID,
    p_group_id UUID
)
RETURNS TABLE (
    user_id UUID,
    group_id UUID,
    hide_photos_from_group BOOLEAN
) LANGUAGE plpgsql AS $$
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

-- Function to update user's group-specific photo settings
CREATE OR REPLACE FUNCTION public.update_user_group_photo_settings(
    p_user_id UUID,
    p_group_id UUID,
    p_hide_photos_from_group BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_group_photo_settings (user_id, group_id, hide_photos_from_group, updated_at)
    VALUES (p_user_id, p_group_id, p_hide_photos_from_group, NOW())
    ON CONFLICT (user_id, group_id) 
    DO UPDATE SET 
        hide_photos_from_group = p_hide_photos_from_group,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get all group photo settings for a user
CREATE OR REPLACE FUNCTION public.get_user_all_group_photo_settings(p_user_id UUID)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    hide_photos_from_group BOOLEAN
) LANGUAGE plpgsql AS $$
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