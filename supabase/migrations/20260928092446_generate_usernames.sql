-- Signup never set profiles.username, so those users render as "unknown user"
-- everywhere. Generate one at signup, and backfill the profiles that have none.

-- Builds a unique username: slug of the full name, else the email local part
-- (Apple relay addresses are skipped, their local part is random), else "user".
-- Slugs under 4 chars are rejected to match the profile form's minimum.
CREATE OR REPLACE FUNCTION public.generate_username(p_full_name text, p_email text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := coalesce(p_email, '');
  v_source text;
  v_slug text;
  v_base text := 'user';
  v_candidate text;
  v_attempt int := 0;
BEGIN
  FOREACH v_source IN ARRAY ARRAY[
    p_full_name,
    CASE
      WHEN lower(split_part(v_email, '@', 2)) <> 'privaterelay.appleid.com'
        THEN split_part(v_email, '@', 1)
    END
  ] LOOP
    v_slug := trim(both '_' from left(
      regexp_replace(
        translate(
          replace(lower(coalesce(v_source, '')), 'ß', 'ss'),
          'äöüéèêáàâíìóòôúùûñç',
          'aoueeeaaaiioooouuunc'
        ),
        '[^a-z0-9]+', '_', 'g'
      ),
      20
    ));

    IF char_length(v_slug) >= 4 THEN
      v_base := v_slug;
      EXIT;
    END IF;
  END LOOP;

  LOOP
    -- A real slug is tried bare first; the "user" fallback always gets a suffix.
    IF v_attempt = 0 AND v_base <> 'user' THEN
      v_candidate := v_base;
    ELSIF v_attempt < 10 THEN
      v_candidate := v_base || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
    ELSE
      v_candidate := v_base || '_' || substr(md5(random()::text), 1, 8);
    END IF;

    -- Existing usernames are free-form, so compare case-insensitively.
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(username) = v_candidate
    );
    v_attempt := v_attempt + 1;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- Supabase default privileges grant new functions to anon/authenticated
-- directly, so PUBLIC alone is not enough.
REVOKE ALL ON FUNCTION public.generate_username(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_full_name text := NEW.raw_user_meta_data->>'full_name';
BEGIN
  -- Insert profile without RLS checks (SECURITY DEFINER context)
  BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
      NEW.id,
      public.generate_username(v_full_name, NEW.email),
      v_full_name,
      NEW.raw_user_meta_data->>'avatar_url'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Lost a race for the generated username. Signup must not fail over
      -- it, so create the profile without one. A duplicate id re-raises below.
      INSERT INTO public.profiles (id, full_name, avatar_url)
      VALUES (
        NEW.id,
        v_full_name,
        NEW.raw_user_meta_data->>'avatar_url'
      );
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    -- Re-raise the error
    RAISE;
END;
$$;

-- Oldest accounts first so they get the cleanest handles. Each UPDATE is
-- visible to the next generate_username call, which keeps the batch unique.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.username IS NULL
    ORDER BY u.created_at
  LOOP
    UPDATE public.profiles
    SET username = public.generate_username(r.full_name, r.email),
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$$;
