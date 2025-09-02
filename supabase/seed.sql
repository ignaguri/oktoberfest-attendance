BEGIN;

-- Create storage buckets for avatars and beer pictures
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('beer_pictures', 'beer_pictures', true);

-- create test users
INSERT INTO
    auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) (
        select
            '00000000-0000-0000-0000-000000000000',
            uuid_generate_v4 (),
            'authenticated',
            'authenticated',
            'user' || (ROW_NUMBER() OVER ()) || '@example.com',
            crypt ('password', gen_salt ('bf')),
            current_timestamp,
            current_timestamp,
            current_timestamp,
            '{"provider":"email","providers":["email"]}',
            '{}',
            current_timestamp,
            current_timestamp,
            '',
            '',
            '',
            ''
        FROM
            generate_series(1, 10)
    );

-- Seed the profiles table using data from auth.users with improved names
INSERT INTO profiles (id, updated_at, username, full_name, avatar_url)
SELECT
    u.id,
    current_timestamp AS updated_at,
    substring(u.email from 1 for position('@' in u.email) - 1) AS username,
    'User ' || (ROW_NUMBER() OVER (ORDER BY u.email) - 1) AS full_name,
    '' AS avatar_url
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
    updated_at = EXCLUDED.updated_at,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;

-- Insert current 2025 Oktoberfest data first
INSERT INTO festivals (
  name, short_name, festival_type, location, 
  start_date, end_date, map_url, 
  is_active, status, description
) VALUES (
  'Oktoberfest 2025', 
  'oktoberfest-2025',
  'oktoberfest',
  'Munich, Germany',
  '2025-09-20',
  '2025-10-05', 
  'https://wiesnmap.muenchen.de/',
  true,
  'active',
  'The 190th Oktoberfest in Munich'
),
(
  'OktoberTest 2025', 
  'oktobertest-2025',
  'oktoberfest',
  'Munich, Germany',
  '2025-08-01',
  '2025-09-20', 
  'https://wiesnmap.muenchen.de/',
  false,
  'active',
  'Test festival for development and testing'
);

-- Seed the attendances table with random attendances for the 10 users
-- Now explicitly reference the 2025 festival
INSERT INTO attendances (user_id, festival_id, date, beer_count)
SELECT
    p.id AS user_id,
    (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2025') AS festival_id,
    current_timestamp - (random() * 365)::integer * interval '1 day' AS date,
    (random() * 10)::integer AS beer_count
FROM profiles p;

-- Insert groups with created_by set to one of the user IDs
-- Now explicitly reference the 2025 festival
INSERT INTO groups (id, name, password, winning_criteria_id, festival_id, created_at, created_by)
SELECT
    uuid_generate_v4(),
    'Group ' || chr(65 + (ROW_NUMBER() OVER ())::int - 1),
    crypt('password' || chr(65 + (ROW_NUMBER() OVER ())::int - 1), gen_salt('bf')),
    (SELECT id FROM winning_criteria ORDER BY RANDOM() LIMIT 1),
    (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2025'),
    current_timestamp,
    u.id
FROM
    auth.users u
LIMIT 3;

-- Insert group members using user IDs
INSERT INTO group_members (id, group_id, user_id, joined_at)
SELECT
    uuid_generate_v4(),
    g.id,
    u.id,
    current_timestamp
FROM
    groups g,
    auth.users u
WHERE
    (g.name = 'Group A' AND u.id IN (
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 0),
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 1)
    ))
    OR (g.name = 'Group B' AND u.id IN (
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 2),
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 3)
    ))
    OR (g.name = 'Group C' AND u.id IN (
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 4),
        (SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 5)
    ));

-- QA: Notification preferences toggles for a few users
-- u0: reminders disabled; u1: group notifications disabled; u2: achievements disabled
INSERT INTO user_notification_preferences (
  user_id, reminders_enabled, group_notifications_enabled, achievement_notifications_enabled
)
VALUES
  ((SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 0), false, true, true),
  ((SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 1), true, false, true),
  ((SELECT id FROM auth.users ORDER BY email LIMIT 1 OFFSET 2), true, true, false)
ON CONFLICT (user_id) DO UPDATE SET
  reminders_enabled = EXCLUDED.reminders_enabled,
  group_notifications_enabled = EXCLUDED.group_notifications_enabled,
  achievement_notifications_enabled = EXCLUDED.achievement_notifications_enabled,
  updated_at = now();

-- QA: Seed reservations to cover reminder-due, prompt-due, and early-checkin cases
-- Common context
DO $$
DECLARE
  v_festival_id uuid;
  v_tent_id uuid;
  v_user0 uuid;
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'oktoberfest-2025' LIMIT 1;
  SELECT id INTO v_tent_id FROM tents WHERE name = 'Hofbräu-Festzelt' LIMIT 1;
  SELECT id INTO v_user0 FROM auth.users ORDER BY email LIMIT 1 OFFSET 0;
  SELECT id INTO v_user1 FROM auth.users ORDER BY email LIMIT 1 OFFSET 1;
  SELECT id INTO v_user2 FROM auth.users ORDER BY email LIMIT 1 OFFSET 2;

  -- Due reminder soon: start_at in 55 minutes with a 60-minute offset => reminder due now
  INSERT INTO reservations (
    id, user_id, festival_id, tent_id, start_at, end_at, status,
    reminder_offset_minutes, visible_to_groups, note
  ) VALUES (
    gen_random_uuid(), v_user0, v_festival_id, v_tent_id,
    now() + interval '55 minutes', NULL, 'scheduled',
    60, true, 'QA: reminder-due'
  );

  -- Due prompt: start_at in the past by 1 minute => prompt due now
  INSERT INTO reservations (
    id, user_id, festival_id, tent_id, start_at, end_at, status,
    reminder_offset_minutes, visible_to_groups, note
  ) VALUES (
    gen_random_uuid(), v_user1, v_festival_id, v_tent_id,
    now() - interval '1 minute', NULL, 'scheduled',
    1440, true, 'QA: prompt-due'
  );

  -- Early check-in: attendance exists earlier today; reservation start_at now - 1 minute
  -- Cron should treat as completed/skip prompt depending on RPC logic
  INSERT INTO attendances (user_id, festival_id, date, beer_count)
  VALUES (v_user2, v_festival_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, date, festival_id) DO NOTHING;

  INSERT INTO reservations (
    id, user_id, festival_id, tent_id, start_at, end_at, status,
    reminder_offset_minutes, visible_to_groups, note
  ) VALUES (
    gen_random_uuid(), v_user2, v_festival_id, v_tent_id,
    now() - interval '1 minute', NULL, 'scheduled',
    1440, true, 'QA: early-checkin-reservation'
  );
END $$;

-- QA: Seed achievements to produce notification events (common + rare/epic)
DO $$
DECLARE
  v_user3 uuid;
  v_user4 uuid;
  v_common_ach uuid;
  v_epic_ach uuid;
  v_festival_id uuid;
BEGIN
  SELECT id INTO v_user3 FROM auth.users ORDER BY email LIMIT 1 OFFSET 3;
  SELECT id INTO v_user4 FROM auth.users ORDER BY email LIMIT 1 OFFSET 4;
  SELECT id INTO v_common_ach FROM achievements WHERE rarity = 'common' LIMIT 1;
  SELECT id INTO v_epic_ach FROM achievements WHERE rarity = 'epic' LIMIT 1;
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'oktoberfest-2025' LIMIT 1;

  IF v_common_ach IS NOT NULL THEN
    INSERT INTO user_achievements (user_id, festival_id, achievement_id, unlocked_at)
    VALUES (v_user3, v_festival_id, v_common_ach, now())
    ON CONFLICT (user_id, achievement_id, festival_id) DO NOTHING;
  END IF;

  IF v_epic_ach IS NOT NULL THEN
    INSERT INTO user_achievements (user_id, festival_id, achievement_id, unlocked_at)
    VALUES (v_user4, v_festival_id, v_epic_ach, now())
    ON CONFLICT (user_id, achievement_id, festival_id) DO NOTHING;
  END IF;
END $$;

-- Commit the transaction to save the changes
COMMIT;