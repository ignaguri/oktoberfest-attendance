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

-- =====================================================
-- FESTIVALS
-- =====================================================

-- Insert Test Festival (always current: -10 days to +10 days)
-- This is the primary festival for development/testing
INSERT INTO festivals (
  id, name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description, beer_cost
) VALUES (
  'a0000000-0000-4000-a000-000000000001',
  'Test Festival',
  'test-festival',
  'oktoberfest',
  'Munich, Germany',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '10 days',
  'https://wiesnmap.muenchen.de/',
  true,
  'active',
  'Always-active test festival for development',
  16.20
);

-- Insert Oktoberfest 2025 for reference (inactive - only one festival can be active)
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
  false,
  'ended',
  'The 190th Oktoberfest in Munich'
);

-- Seed winning criteria (required for groups)
INSERT INTO winning_criteria (id, name) VALUES
  (1, 'days_attended'),
  (2, 'total_beers'),
  (3, 'avg_beers')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TENTS
-- =====================================================

-- Seed tents (Oktoberfest venues)
INSERT INTO tents (id, name, category) VALUES
  ('55ff3af6-f1d6-481a-a8f4-58fa23f00f68', 'Armbrustschützen Festzelt', 'large'),
  ('631abb99-4237-4bbc-94d7-2a6c18e11e25', 'Augustiner-Festhalle', 'large'),
  ('907342a2-ab22-4b27-8ebd-f7225a4d13e7', 'Boandlkramerei', 'old'),
  ('bbbf2c29-7b2e-487a-bcfc-c4b75547f83a', 'Bodo''s Cafézelt & Cocktailbar', 'small'),
  ('1764c5e2-6f01-4119-a55a-7d0efe3ae861', 'Café Theres''', 'small'),
  ('28a517af-f440-4102-9ad3-beaed8347061', 'Feisingers Kas- und Weinstubn', 'small'),
  ('9eb72005-8026-4665-be77-4a61fbcc3fa1', 'Festhalle Schottenhamel', 'large'),
  ('f2df3186-ec0d-467f-a560-fffa48a72897', 'Festzelt Tradition', 'old'),
  ('f8e94181-3a63-4e68-9285-588038be343f', 'Fisch-Bäda', 'small'),
  ('da36b13f-1e75-4299-9f75-1de4eb38b416', 'Fischer-Vroni', 'large'),
  ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e', 'Glöckle-Wirt', 'small'),
  ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404', 'Goldener Hahn', 'small'),
  ('282d326c-0e14-43e2-b8c6-9bf098a0fde6', 'Hacker-Festzelt', 'large'),
  ('6d4e022d-c033-4a56-a19b-441dfe8430fd', 'Heimer Enten- und Hühnerbraterei', 'small'),
  ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6', 'Heinz Wurst- und Hühnerbraterei', 'small'),
  ('668a1446-8af3-44a5-92c5-8c04bccd80e3', 'Herzkasperlzelt', 'old'),
  ('ecaae5eb-9745-4359-826a-9a14aa91591b', 'Hochreiters Haxnbraterei', 'small'),
  ('253eb29d-8efe-4095-9671-4eff02704c4a', 'Hofbräu-Festzelt', 'large'),
  ('24b50db1-f7c1-4132-a07c-00ad2cb8c2e1', 'Hühner- und Entenbraterei Ammer', 'small'),
  ('37ad3fc4-9d52-4e19-91c7-a01ed11c6854', 'Käfer Wiesn-Schänke', 'large'),
  ('2196e0ea-1262-4f2c-97ef-bcd67104ae72', 'Kalbsbraterei', 'small'),
  ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d', 'Kufflers Weinzelt', 'large'),
  ('dd7b4b6d-7a57-411a-baf8-8c0d20682b64', 'Löwenbräu-Festzelt', 'large'),
  ('49449d2f-c9b7-4b8b-9ed7-889690493c3d', 'Marstall-Festzelt', 'large'),
  ('0898010d-693f-47be-b8f2-5916ad5a56d0', 'Münchner Knödelei', 'small'),
  ('ce088585-ac22-447f-817d-1c4a28779d07', 'Münchner Stubn', 'small'),
  ('a20effb6-612e-4085-8de0-6fbc0dff1dc1', 'Münchner Weißbiergarten', 'small'),
  ('655190b1-ca0d-4d5a-8def-74f8a20f1e2b', 'Museumzelt', 'old'),
  ('017977ea-a9c3-4865-b494-edc49efc6212', 'Ochsenbraterei', 'large'),
  ('0935a117-4fe2-46fb-b8fa-fc45d9496af9', 'Paulaner Festzelt', 'large'),
  ('4d140654-f235-44b8-8d6e-8f23e57274a2', 'Pschorr-Festzelt Bräurosl', 'large'),
  ('cb0a2849-159f-48f6-902f-fba73ae9c9a2', 'Rischart''s Café Kaiserschmarrn', 'small'),
  ('014c7c7e-f904-4fcc-931f-2b80c9ceff2b', 'Schiebl''s Kaffeehaferl', 'small'),
  ('5deac267-6401-437f-adae-e81769e4e781', 'Schützen-Festzelt', 'large'),
  ('949ee890-ee80-406c-af23-ded34e838b44', 'Vinzenzmurr Metzger Stubn', 'small'),
  ('e61d04d2-6a16-4069-bf79-85dcf4827c94', 'Volkssängerzelt Schützenlisl', 'old'),
  ('7b91d421-5052-4109-b47f-8136f3bb9a89', 'Wiesn Guglhupf', 'small'),
  ('5162f382-2321-495c-b723-942a4708811e', 'Wildstuben', 'small'),
  ('b349fe59-e104-42f1-9157-1859d829c1fa', 'Wirtshaus im Schichtl', 'small'),
  ('387574a0-8c63-4bf0-a4d0-a0bc37158ddd', 'Zur Bratwurst', 'small'),
  ('2b8dcaaf-b24b-4f8e-8496-012120df341c', 'Zur Schönheitskönigin', 'old')
ON CONFLICT (id) DO NOTHING;

-- Link all tents to the Test Festival via festival_tents
INSERT INTO festival_tents (festival_id, tent_id, beer_price)
SELECT
  'a0000000-0000-4000-a000-000000000001'::uuid,
  t.id,
  16.20 + (random() * 2)::numeric(5,2) -- Slight price variation per tent
FROM tents t
ON CONFLICT (festival_id, tent_id) DO NOTHING;

-- Also link tents to Oktoberfest 2025
INSERT INTO festival_tents (festival_id, tent_id, beer_price)
SELECT
  (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2025'),
  t.id,
  16.20
FROM tents t
ON CONFLICT (festival_id, tent_id) DO NOTHING;

-- =====================================================
-- ACHIEVEMENTS
-- =====================================================

-- Seed achievements
INSERT INTO achievements (id, name, description, icon, category, rarity, points, conditions, is_active) VALUES
  ('99887469-29c6-4608-8320-0e0ec2b4295d', 'First Drop', 'Record your first beer at the festival', 'first_beer', 'consumption', 'common', 10, '{"type":"threshold","target_value":1,"comparison_operator":"gte"}', true),
  ('eca2f74f-ecac-4bf4-a61c-b256c04eefcf', 'Beer Rookie', 'Reach 3 total beers', 'beer_mug', 'consumption', 'common', 25, '{"type":"threshold","target_value":3,"comparison_operator":"gte"}', true),
  ('16ce8ab4-f54a-4564-9b06-77630736ca5e', 'Halfway There', 'Reach 5 total beers in a festival', 'beer_mug', 'consumption', 'common', 40, '{"type":"threshold","target_value":5,"comparison_operator":"gte"}', true),
  ('7cd82be0-0183-4f95-be19-9c4352970e94', 'Serious Session', 'Drink 3+ beers in a single day', 'fire', 'consumption', 'common', 35, '{"type":"threshold","target_value":3,"comparison_operator":"gte"}', true),
  ('efe5949e-35c2-4ea6-9b13-70213094092b', 'Serious Drinker', 'Reach 8 total beers', 'beer_bottle', 'consumption', 'rare', 50, '{"type":"threshold","target_value":8,"comparison_operator":"gte"}', true),
  ('46381a3d-eab6-47a2-b611-086ef75ec81a', 'Double Digits', 'Reach 10 total beers in a festival', 'beer_bottle', 'consumption', 'rare', 75, '{"type":"threshold","target_value":10,"comparison_operator":"gte"}', true),
  ('1ea2d622-cc6c-45c0-b712-2fed0abf846e', 'Daily Double', 'Drink 4+ beers in a single day', 'fire', 'consumption', 'rare', 75, '{"type":"threshold","target_value":4,"comparison_operator":"gte"}', true),
  ('aa297d17-22e9-4890-94de-7b7cdf15c8b2', 'Beer Enthusiast', 'Reach 15 total beers', 'beer_cheers', 'consumption', 'rare', 100, '{"type":"threshold","target_value":15,"comparison_operator":"gte"}', true),
  ('4051ed2b-a909-4ef9-8e27-bec68e58219b', 'Power Hour', 'Drink 6+ beers in a single day', 'lightning', 'consumption', 'epic', 150, '{"type":"threshold","target_value":6,"comparison_operator":"gte"}', true),
  ('ac5dfcb4-5711-4afc-b074-02f6ba5a778f', 'Marathon Drinker', 'Reach 20+ beers in a single festival', 'trophy', 'consumption', 'epic', 150, '{"type":"threshold","target_value":20,"comparison_operator":"gte"}', true),
  ('06cf3cae-b9e8-49ac-b4f7-e83a02806a27', 'Century Club', 'Reach 30 beers across all festivals', 'trophy', 'consumption', 'epic', 250, '{"type":"threshold","target_value":30,"comparison_operator":"gte"}', true),
  ('9b9c483b-908d-4ec8-9616-21b56d224671', 'Legend Status', 'Reach 50+ beers across all festivals', 'crown', 'consumption', 'legendary', 300, '{"type":"threshold","target_value":50,"comparison_operator":"gte"}', true),
  ('715b340d-840c-4b9b-af9f-5e582e65e62a', 'Festival Newcomer', 'Attend your first day', 'wave', 'attendance', 'common', 10, '{"type":"threshold","target_value":1,"comparison_operator":"gte"}', true),
  ('49a0a591-9f22-45b9-8cfe-a496dbe7cdde', 'Regular', 'Attend 3 different days', 'calendar', 'attendance', 'common', 30, '{"type":"threshold","target_value":3,"comparison_operator":"gte"}', true),
  ('e10c554d-7dec-46da-ae84-fa0fbcecb363', 'Early Bird', 'Attend the first day of the festival', 'sunrise', 'attendance', 'rare', 50, '{"type":"special","date_specific":"first_day"}', true),
  ('86facf10-075e-4cd3-96c7-061c2840ec27', 'Dedicated', 'Attend 5 different days', 'star', 'attendance', 'rare', 75, '{"type":"threshold","target_value":5,"comparison_operator":"gte"}', true),
  ('679f3df9-18eb-424b-89ff-681e8c8241da', 'Streak Master', 'Attend 3 consecutive days', 'flame', 'attendance', 'epic', 100, '{"type":"streak","min_days":3}', true),
  ('4a33b3de-54b1-4c5e-a969-2525da02e602', 'Weekend Warrior', 'Attend all weekends during the festival', 'weekend', 'attendance', 'epic', 150, '{"type":"special"}', true),
  ('b426510e-747f-4bce-97f1-49ae4bc64388', 'Festival Warrior', 'Perfect attendance - attend all festival days', 'crown', 'attendance', 'legendary', 200, '{"type":"special","comparison_operator":"eq"}', true),
  ('cbbfd119-ec88-4df5-80fc-199ec0892082', 'Tent Curious', 'Visit 3 different tents', 'tent', 'explorer', 'common', 25, '{"type":"variety","target_value":3}', true),
  ('08d3c37c-ff26-4956-9bb2-6c9bc6d0c077', 'Tent Hopper', 'Visit 5 different tents', 'map', 'explorer', 'rare', 50, '{"type":"variety","target_value":5}', true),
  ('42fca5ef-15c0-4b2e-830d-6ae7bbb662ce', 'Wiesn Wanderer', 'Visit all tent categories', 'compass', 'explorer', 'epic', 100, '{"type":"variety","tent_categories":["beer_tent","wine_tent","food_tent"]}', true),
  ('7c15d1b3-4165-4e4e-8635-dc61248493f9', 'Local Guide', 'Visit 10+ different tents', 'guide', 'explorer', 'epic', 150, '{"type":"variety","target_value":10}', true),
  ('ab5c2066-ae04-4067-955b-ee902649c2ea', 'Tent Master', 'Visit 15+ different tents', 'master', 'explorer', 'legendary', 250, '{"type":"variety","target_value":15}', true),
  ('f76d4efa-8c34-443f-86a6-4b58572846f9', 'Team Player', 'Join your first group', 'handshake', 'social', 'common', 20, '{"type":"threshold","target_value":1,"comparison_operator":"gte"}', true),
  ('063f4ec6-5ff3-453d-b02f-a907d72b0e96', 'Group Leader', 'Create your first group', 'leader', 'social', 'rare', 50, '{"type":"threshold","target_value":1,"comparison_operator":"gte"}', true),
  ('f17e7f74-5210-4e2d-9cb3-5b5168fede83', 'Photo Enthusiast', 'Upload 10+ photos', 'camera', 'social', 'rare', 50, '{"type":"threshold","target_value":10,"comparison_operator":"gte"}', true),
  ('23476940-e972-454f-8c2d-908be103586e', 'Social Butterfly', 'Join 3+ groups', 'butterfly', 'social', 'rare', 75, '{"type":"threshold","target_value":3,"comparison_operator":"gte"}', true),
  ('78abd5ce-358c-45ee-acff-7aa792acb010', 'Top Contributor', 'Finish in top 3 of a group', 'podium', 'social', 'rare', 75, '{"type":"special"}', true),
  ('e3eade37-6f11-435f-af12-fb0a2dbb337a', 'Group Champion', 'Win a group competition', 'medal', 'social', 'epic', 100, '{"type":"special"}', true),
  ('567104dd-fda1-413e-9824-4a66979be3fe', 'Memory Keeper', 'Upload 25+ photos', 'photo_album', 'social', 'epic', 100, '{"type":"threshold","target_value":25,"comparison_operator":"gte"}', true),
  ('36a4c5a2-8b3d-47a0-b45e-bce0763e8292', 'Rising Star', 'Finish in top 5 of global leaderboard', 'rising_star', 'competitive', 'epic', 150, '{"type":"special"}', true),
  ('fc04f26e-87d7-40cf-87d7-d5c7bfda1460', 'Multi-Group Champion', 'Win competitions in 2+ different groups', 'multi_trophy', 'competitive', 'legendary', 200, '{"type":"threshold","target_value":2,"comparison_operator":"gte"}', true),
  ('293be4f4-9c01-49a0-8d5e-021139c4fed7', 'Leaderboard Legend', 'Finish in top 3 of global leaderboard', 'legend', 'competitive', 'legendary', 300, '{"type":"special"}', true),
  ('28ff2ae8-5e5a-4b71-95d2-148f045155e0', 'Closing Time', 'Attend the last day of the festival', 'closing', 'special', 'rare', 75, '{"type":"special","date_specific":"last_day"}', true),
  ('4ef9ced6-c34d-4464-aaf2-2f4bbe551339', 'Opening Day Legend', 'Attend the very first day of your first festival', 'first_day', 'special', 'rare', 100, '{"type":"special","date_specific":"opening_day"}', true),
  ('f826973d-7db4-4944-8ed3-f4d3d4176ad5', 'Consistency King', 'Same beer count 3+ days in a row', 'consistency', 'special', 'epic', 100, '{"type":"special"}', true),
  ('08349ebd-f05a-4e68-bc51-bb077966da48', 'Festival Veteran', 'Participate in 2+ different festivals', 'veteran', 'special', 'epic', 150, '{"type":"threshold","target_value":2,"comparison_operator":"gte"}', true),
  ('51ba02b9-f970-4103-8f74-7922afbe1a82', 'Photo Perfect', 'Upload at least one photo every day attended', 'perfect', 'special', 'epic', 150, '{"type":"special"}', true),
  ('8a32799d-a53f-414f-865b-b7a35ba57b34', 'High Roller', 'Spend 500+ euros on beers in a single festival', 'money_bag', 'special', 'epic', 200, '{"type":"threshold","target_value":500,"comparison_operator":"gte"}', true),
  ('ee6032e6-373d-457d-af9b-79a102d72bda', 'Multi-Year Champion', 'Win group competitions in 2+ festivals', 'multi_year', 'special', 'legendary', 300, '{"type":"threshold","target_value":2,"comparison_operator":"gte"}', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- GROUPS (for Test Festival)
-- =====================================================

-- Insert groups linked to Test Festival
-- Group A: Users 1 and 2
-- Group B: Users 2 and 3 (user 2 is in both groups for testing)
-- Group C: Users 4, 5, and 6
DO $$
DECLARE
  v_test_festival_id uuid := 'a0000000-0000-4000-a000-000000000001';
  v_user1 uuid;
  v_user2 uuid;
  v_user3 uuid;
  v_user4 uuid;
  v_user5 uuid;
  v_user6 uuid;
  v_group_a uuid;
  v_group_b uuid;
  v_group_c uuid;
BEGIN
  SELECT id INTO v_user1 FROM auth.users ORDER BY email LIMIT 1 OFFSET 0;
  SELECT id INTO v_user2 FROM auth.users ORDER BY email LIMIT 1 OFFSET 1;
  SELECT id INTO v_user3 FROM auth.users ORDER BY email LIMIT 1 OFFSET 2;
  SELECT id INTO v_user4 FROM auth.users ORDER BY email LIMIT 1 OFFSET 3;
  SELECT id INTO v_user5 FROM auth.users ORDER BY email LIMIT 1 OFFSET 4;
  SELECT id INTO v_user6 FROM auth.users ORDER BY email LIMIT 1 OFFSET 5;

  -- Create Group A
  v_group_a := gen_random_uuid();
  INSERT INTO groups (id, name, password, winning_criteria_id, festival_id, created_at, created_by)
  VALUES (v_group_a, 'Test Group A', crypt('passwordA', gen_salt('bf')), 2, v_test_festival_id, now(), v_user1);

  -- Create Group B
  v_group_b := gen_random_uuid();
  INSERT INTO groups (id, name, password, winning_criteria_id, festival_id, created_at, created_by)
  VALUES (v_group_b, 'Test Group B', crypt('passwordB', gen_salt('bf')), 2, v_test_festival_id, now(), v_user2);

  -- Create Group C
  v_group_c := gen_random_uuid();
  INSERT INTO groups (id, name, password, winning_criteria_id, festival_id, created_at, created_by)
  VALUES (v_group_c, 'Test Group C', crypt('passwordC', gen_salt('bf')), 1, v_test_festival_id, now(), v_user4);

  -- Add members to Group A (users 1 and 2)
  INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES
    (gen_random_uuid(), v_group_a, v_user1, now() - interval '5 days'),
    (gen_random_uuid(), v_group_a, v_user2, now() - interval '4 days');

  -- Add members to Group B (users 2 and 3)
  INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES
    (gen_random_uuid(), v_group_b, v_user2, now() - interval '3 days'),
    (gen_random_uuid(), v_group_b, v_user3, now() - interval '2 days');

  -- Add members to Group C (users 4, 5, 6)
  INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES
    (gen_random_uuid(), v_group_c, v_user4, now() - interval '6 days'),
    (gen_random_uuid(), v_group_c, v_user5, now() - interval '5 days'),
    (gen_random_uuid(), v_group_c, v_user6, now() - interval '4 days');
END $$;

-- =====================================================
-- ATTENDANCES & CONSUMPTIONS (for Test Festival)
-- =====================================================

-- Create attendances and consumptions for users in the Test Festival
DO $$
DECLARE
  v_test_festival_id uuid := 'a0000000-0000-4000-a000-000000000001';
  v_user record;
  v_attendance_id uuid;
  v_day_offset int;
  v_num_drinks int;
  v_drink_idx int;
  v_drink_type text;
  v_tent_id uuid;
  v_drink_types text[] := ARRAY['beer', 'beer', 'beer', 'radler', 'wine', 'soft_drink'];
BEGIN
  -- Loop through first 6 users (those in groups)
  FOR v_user IN (SELECT id FROM auth.users ORDER BY email LIMIT 6)
  LOOP
    -- Create attendances for past few days (within last 5 days to appear in activity feed)
    FOR v_day_offset IN 0..4
    LOOP
      -- Skip some days randomly to simulate real usage
      IF random() > 0.3 THEN
        v_attendance_id := gen_random_uuid();

        -- Get a random tent for this attendance
        SELECT id INTO v_tent_id FROM tents ORDER BY random() LIMIT 1;

        -- Create attendance record
        INSERT INTO attendances (id, user_id, festival_id, date, beer_count)
        VALUES (
          v_attendance_id,
          v_user.id,
          v_test_festival_id,
          CURRENT_DATE - (v_day_offset || ' days')::interval,
          0 -- beer_count is now deprecated, we use consumptions
        );

        -- Create tent visit
        INSERT INTO tent_visits (id, user_id, festival_id, tent_id, visit_date)
        VALUES (gen_random_uuid(), v_user.id, v_test_festival_id, v_tent_id, now() - (v_day_offset || ' days')::interval)
        ON CONFLICT DO NOTHING;

        -- Create random number of consumptions (1-5 drinks)
        v_num_drinks := 1 + floor(random() * 5)::int;

        FOR v_drink_idx IN 1..v_num_drinks
        LOOP
          -- Pick a random drink type (weighted towards beer)
          v_drink_type := v_drink_types[1 + floor(random() * array_length(v_drink_types, 1))::int];

          INSERT INTO consumptions (
            attendance_id,
            tent_id,
            drink_type,
            base_price_cents,
            price_paid_cents,
            volume_ml,
            recorded_at
          ) VALUES (
            v_attendance_id,
            v_tent_id,
            v_drink_type::drink_type,
            1620, -- €16.20 base
            1620 + floor(random() * 200)::int, -- Some tip variation
            1000, -- 1L
            now() - (v_day_offset || ' days')::interval + (v_drink_idx || ' hours')::interval
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- QA: NOTIFICATION PREFERENCES
-- =====================================================

-- QA: Notification preferences toggles for a few users
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

-- =====================================================
-- QA: RESERVATIONS
-- =====================================================

DO $$
DECLARE
  v_festival_id uuid := 'a0000000-0000-4000-a000-000000000001';
  v_tent_id uuid;
  v_user0 uuid;
  v_user1 uuid;
  v_user2 uuid;
BEGIN
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

  -- Early check-in reservation
  INSERT INTO reservations (
    id, user_id, festival_id, tent_id, start_at, end_at, status,
    reminder_offset_minutes, visible_to_groups, note
  ) VALUES (
    gen_random_uuid(), v_user2, v_festival_id, v_tent_id,
    now() - interval '1 minute', NULL, 'scheduled',
    1440, true, 'QA: early-checkin-reservation'
  );
END $$;

-- =====================================================
-- QA: ACHIEVEMENTS
-- =====================================================

DO $$
DECLARE
  v_user3 uuid;
  v_user4 uuid;
  v_common_ach uuid;
  v_epic_ach uuid;
  v_festival_id uuid := 'a0000000-0000-4000-a000-000000000001';
BEGIN
  SELECT id INTO v_user3 FROM auth.users ORDER BY email LIMIT 1 OFFSET 3;
  SELECT id INTO v_user4 FROM auth.users ORDER BY email LIMIT 1 OFFSET 4;
  SELECT id INTO v_common_ach FROM achievements WHERE rarity = 'common' LIMIT 1;
  SELECT id INTO v_epic_ach FROM achievements WHERE rarity = 'epic' LIMIT 1;

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
