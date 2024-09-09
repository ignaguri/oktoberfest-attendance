BEGIN;

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

-- Seed the profiles table using data from auth.users
INSERT INTO profiles (id, updated_at, username, full_name, avatar_url)
SELECT
    u.id,
    current_timestamp AS updated_at,
    substring(u.email from 1 for position('@' in u.email) - 1) AS username,
    '' AS full_name,
    '' AS avatar_url
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
    updated_at = EXCLUDED.updated_at,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;

-- Seed the attendances table with random attendances for the 10 users
-- Replace 'userX_id' with the actual user IDs from the profiles table

INSERT INTO attendances (user_id, date, beer_count)
SELECT
    p.id AS user_id,
    current_timestamp - (random() * 365)::integer * interval '1 day' AS date,
    (random() * 10)::integer AS beer_count
FROM profiles p;

-- Insert groups with created_by set to one of the user IDs
INSERT INTO groups (id, name, password, created_at, created_by)
SELECT
    uuid_generate_v4(),
    'Group ' || chr(65 + (ROW_NUMBER() OVER ())::int - 1),
    crypt('password' || chr(65 + (ROW_NUMBER() OVER ())::int - 1), gen_salt('bf')),
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

-- Commit the transaction to save the changes
COMMIT;