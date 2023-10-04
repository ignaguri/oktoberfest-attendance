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
INSERT INTO profiles (id, updated_at, username, full_name, avatar_url, website)
SELECT
    u.id,
    current_timestamp AS updated_at,
    REPLACE(u.email, '@', '') AS username,
    '' AS full_name,
    '' AS avatar_url,
    '' AS website
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = u.id
);

-- Seed the attendance table with random attendances for the 10 users
-- Replace 'userX_id' with the actual user IDs from the profiles table

INSERT INTO attendance (user_id, date, liters)
SELECT
    p.id AS user_id,
    current_timestamp - (random() * 365)::integer * interval '1 day' AS date,
    (random() * 10)::integer AS liters
FROM profiles p;

-- Commit the transaction to save the changes

COMMIT;