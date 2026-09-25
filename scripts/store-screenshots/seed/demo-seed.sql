-- ProstCounter store-screenshot demo world. Idempotent: wipes and recreates demo.*@example.com.
-- Hero: demo.sophie@example.com / password. Times are relative to now() because the
-- activity feed only shows the last 48h, so re-run right before capturing.
BEGIN;

CREATE TEMP TABLE demo_users (n int, id uuid, username text, full_name text, bg text) ON COMMIT DROP;
INSERT INTO demo_users VALUES
 (1,'de000000-0000-4000-a000-000000000001','sophie','Sophie Becker','fde68a'),
 (2,'de000000-0000-4000-a000-000000000002','max','Max Huber','bfdbfe'),
 (3,'de000000-0000-4000-a000-000000000003','lukas','Lukas Maier','fecaca'),
 (4,'de000000-0000-4000-a000-000000000004','anna','Anna Schmid','bbf7d0'),
 (5,'de000000-0000-4000-a000-000000000005','tom','Tom Weber','fed7aa'),
 (6,'de000000-0000-4000-a000-000000000006','julia','Julia Fischer','e9d5ff'),
 (7,'de000000-0000-4000-a000-000000000007','diego','Diego Álvarez','a5f3fc'),
 (8,'de000000-0000-4000-a000-000000000008','emma','Emma Wagner','fbcfe8'),
 (9,'de000000-0000-4000-a000-000000000009','jonas','Jonas Bauer','d9f99d');

-- ---------- cleanup ----------
DELETE FROM day_plan_companions WHERE plan_id IN (SELECT id FROM day_plans WHERE user_id IN (SELECT id FROM demo_users));
DELETE FROM day_plans WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM tent_crowd_reports WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM achievement_events WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM user_achievements WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM wrapped_data_cache WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM festival_group_standings WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM consumptions WHERE attendance_id IN (SELECT id FROM attendances WHERE user_id IN (SELECT id FROM demo_users));
DELETE FROM tent_visits WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM attendances WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM group_members WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM groups WHERE created_by IN (SELECT id FROM demo_users);
DELETE FROM friendships WHERE requester_id IN (SELECT id FROM demo_users) OR addressee_id IN (SELECT id FROM demo_users);
DELETE FROM user_notification_preferences WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM profiles WHERE id IN (SELECT id FROM demo_users);
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM demo_users);

-- ---------- users ----------
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  'demo.' || username || '@example.com', crypt('password', gen_salt('bf')), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', now() - interval '400 days', now(), '', '', '', ''
FROM demo_users;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', 'demo.' || username || '@example.com', 'email_verified', true),
  'email', now(), now(), now()
FROM demo_users;

INSERT INTO profiles (id, updated_at, username, full_name, avatar_url, tutorial_completed, tutorial_completed_at, preferred_language)
SELECT id, now(), username, full_name,
  'https://api.dicebear.com/9.x/notionists/png?size=256&seed=' || username || '&backgroundColor=' || bg,
  true, now(), 'en'
FROM demo_users
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url, tutorial_completed = true;

-- Sophie is friends with everyone, plus a few friendships among the others.
INSERT INTO friendships (requester_id, addressee_id, status, created_at)
SELECT s.id, o.id, 'accepted'::friendship_status, now() - interval '300 days' FROM demo_users s, demo_users o WHERE s.n = 1 AND o.n > 1
UNION ALL
SELECT a.id, b.id, 'accepted'::friendship_status, now() - interval '200 days' FROM demo_users a, demo_users b
WHERE (a.n, b.n) IN ((2,3),(2,5),(3,4),(4,6),(5,9),(6,8),(7,8));

-- ---------- per-day drinking log ----------
-- (user, festival, day, tent, beers, radlers, alcohol-free, first drink local time)
CREATE TEMP TABLE demo_log (n int, fest text, day date, tent text, beers int, radlers int, af int, t0 time) ON COMMIT DROP;
INSERT INTO demo_log VALUES
 -- Oktoberfest 2025 (Wrapped)
 (1,'oktoberfest-2025','2025-09-20','Festhalle Schottenhamel',3,0,1,'12:30'),
 (1,'oktoberfest-2025','2025-09-21','Augustiner-Festhalle',4,0,0,'13:00'),
 (1,'oktoberfest-2025','2025-09-26','Hofbräu-Festzelt',3,1,0,'15:00'),
 (1,'oktoberfest-2025','2025-09-27','Paulaner Festzelt',5,0,1,'12:00'),
 (1,'oktoberfest-2025','2025-09-28','Löwenbräu-Festzelt',4,0,0,'13:30'),
 (1,'oktoberfest-2025','2025-10-03','Käfer Wiesn-Schänke',3,1,0,'16:00'),
 (1,'oktoberfest-2025','2025-10-05','Schützen-Festzelt',4,0,1,'12:00'),
 (2,'oktoberfest-2025','2025-09-20','Festhalle Schottenhamel',5,0,0,'12:00'),
 (2,'oktoberfest-2025','2025-09-27','Paulaner Festzelt',6,0,0,'12:00'),
 (2,'oktoberfest-2025','2025-10-04','Hacker-Festzelt',5,0,0,'13:00'),
 (3,'oktoberfest-2025','2025-09-21','Augustiner-Festhalle',3,1,0,'13:00'),
 (3,'oktoberfest-2025','2025-09-28','Löwenbräu-Festzelt',4,0,0,'13:30'),
 (4,'oktoberfest-2025','2025-09-27','Paulaner Festzelt',2,2,1,'12:00'),
 (5,'oktoberfest-2025','2025-09-26','Hofbräu-Festzelt',4,0,0,'15:00'),
 (5,'oktoberfest-2025','2025-10-03','Käfer Wiesn-Schänke',3,0,0,'16:00'),
 (6,'oktoberfest-2025','2025-09-21','Augustiner-Festhalle',2,1,0,'13:00'),
 (8,'oktoberfest-2025','2025-09-27','Paulaner Festzelt',3,0,0,'12:00'),
 -- Oktoberfest 2026, up to today (2026-09-25)
 (1,'oktoberfest-2026','2026-09-19','Festhalle Schottenhamel',3,0,1,'12:00'),
 (1,'oktoberfest-2026','2026-09-20','Augustiner-Festhalle',4,0,1,'13:00'),
 (1,'oktoberfest-2026','2026-09-21','Hofbräu-Festzelt',3,1,0,'14:30'),
 (1,'oktoberfest-2026','2026-09-23','Löwenbräu-Festzelt',2,0,0,'17:00'),
 (1,'oktoberfest-2026','2026-09-23','Paulaner Festzelt',2,0,0,'19:15'),
 (1,'oktoberfest-2026','2026-09-24','Käfer Wiesn-Schänke',3,1,0,'16:00'),
 (1,'oktoberfest-2026','2026-09-25','Schützen-Festzelt',2,0,1,'13:15'),
 (2,'oktoberfest-2026','2026-09-19','Festhalle Schottenhamel',5,0,0,'12:00'),
 (2,'oktoberfest-2026','2026-09-20','Hacker-Festzelt',6,0,0,'12:30'),
 (2,'oktoberfest-2026','2026-09-22','Paulaner Festzelt',4,0,0,'17:00'),
 (2,'oktoberfest-2026','2026-09-24','Augustiner-Festhalle',5,0,0,'15:00'),
 (2,'oktoberfest-2026','2026-09-25','Hofbräu-Festzelt',4,0,0,'12:30'),
 (3,'oktoberfest-2026','2026-09-19','Festhalle Schottenhamel',3,0,0,'12:00'),
 (3,'oktoberfest-2026','2026-09-21','Hofbräu-Festzelt',4,0,0,'14:30'),
 (3,'oktoberfest-2026','2026-09-24','Käfer Wiesn-Schänke',3,0,1,'16:00'),
 (3,'oktoberfest-2026','2026-09-25','Schützen-Festzelt',3,0,0,'13:30'),
 (4,'oktoberfest-2026','2026-09-20','Augustiner-Festhalle',2,1,1,'13:00'),
 (4,'oktoberfest-2026','2026-09-23','Löwenbräu-Festzelt',2,1,0,'17:00'),
 (4,'oktoberfest-2026','2026-09-25','Pschorr-Festzelt Bräurosl',1,1,1,'14:00'),
 (5,'oktoberfest-2026','2026-09-19','Festhalle Schottenhamel',4,0,0,'12:00'),
 (5,'oktoberfest-2026','2026-09-21','Hofbräu-Festzelt',5,0,0,'14:30'),
 (5,'oktoberfest-2026','2026-09-24','Marstall-Festzelt',3,0,0,'18:00'),
 (6,'oktoberfest-2026','2026-09-20','Augustiner-Festhalle',3,0,0,'13:00'),
 (6,'oktoberfest-2026','2026-09-24','Käfer Wiesn-Schänke',2,1,0,'16:00'),
 (6,'oktoberfest-2026','2026-09-25','Schützen-Festzelt',2,0,0,'13:30'),
 (7,'oktoberfest-2026','2026-09-22','Paulaner Festzelt',4,0,0,'17:00'),
 (7,'oktoberfest-2026','2026-09-24','Fischer-Vroni',3,0,0,'18:30'),
 (7,'oktoberfest-2026','2026-09-25','Augustiner-Festhalle',2,0,0,'14:00'),
 (8,'oktoberfest-2026','2026-09-20','Augustiner-Festhalle',2,1,0,'13:00'),
 (8,'oktoberfest-2026','2026-09-23','Löwenbräu-Festzelt',3,0,1,'17:00'),
 (9,'oktoberfest-2026','2026-09-21','Hofbräu-Festzelt',3,0,0,'14:30'),
 (9,'oktoberfest-2026','2026-09-24','Hacker-Festzelt',4,0,0,'17:30');

-- One drink row per drink, 50 minutes apart, from t0 (Munich time).
CREATE TEMP TABLE demo_drinks ON COMMIT DROP AS
SELECT l.*, u.id AS user_id, f.id AS festival_id, t.id AS tent_id, COALESCE(ft.beer_price_cents, round(ft.beer_price * 100)::int, f.default_beer_price_cents, 1510) AS price,
  d.kind, d.ord,
  ((l.day + l.t0) AT TIME ZONE 'Europe/Berlin') + (d.ord - 1) * interval '50 minutes' AS at
FROM demo_log l
JOIN demo_users u ON u.n = l.n
JOIN festivals f ON f.short_name = l.fest
JOIN tents t ON t.name = l.tent
JOIN festival_tents ft ON ft.festival_id = f.id AND ft.tent_id = t.id
CROSS JOIN LATERAL (
  SELECT k.kind, row_number() OVER () AS ord FROM (
    SELECT 'beer'::drink_type AS kind FROM generate_series(1, l.beers)
    UNION ALL SELECT 'radler' FROM generate_series(1, l.radlers)
    UNION ALL SELECT 'alcohol_free' FROM generate_series(1, l.af)
  ) k
) d;

-- Nothing in the future: today's rows are capped to "a few minutes ago".
UPDATE demo_drinks SET at = now() - (8 - ord) * interval '9 minutes' WHERE at > now();

INSERT INTO attendances (user_id, date, festival_id, beer_count, created_at, updated_at)
SELECT user_id, day, festival_id, 0, min(at), max(at) FROM demo_drinks GROUP BY user_id, day, festival_id;

INSERT INTO consumptions (attendance_id, tent_id, drink_type, base_price_cents, price_paid_cents,
  volume_ml, recorded_at, created_at, updated_at)
SELECT a.id, d.tent_id, d.kind,
  CASE d.kind WHEN 'alcohol_free' THEN 1450 ELSE d.price END,
  CASE d.kind WHEN 'alcohol_free' THEN 1500 ELSE d.price + 110 END,
  1000, d.at, d.at, d.at
FROM demo_drinks d JOIN attendances a ON a.user_id = d.user_id AND a.date = d.day AND a.festival_id = d.festival_id;

INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
SELECT gen_random_uuid(), user_id, tent_id, min(at) - interval '10 minutes', festival_id
FROM demo_drinks GROUP BY user_id, tent_id, day, festival_id;

-- ---------- groups ----------
INSERT INTO groups (name, password, created_by, description, winning_criteria_id, festival_id, created_at)
SELECT g.name, 'prost', u.id, g.descr, g.crit, f.id, g.created
FROM (VALUES
  ('Wiesn Crew', 'The usual suspects. Loser buys the Hendl.', 2, 'oktoberfest-2026', now() - interval '20 days'),
  ('Office Wiesn', 'Team outing, but make it competitive.', 1, 'oktoberfest-2026', now() - interval '12 days'),
  ('Wiesn Crew', 'The usual suspects. Loser buys the Hendl.', 2, 'oktoberfest-2025', now() - interval '380 days')
) AS g(name, descr, crit, fest, created)
JOIN festivals f ON f.short_name = g.fest
JOIN demo_users u ON u.n = 1;

INSERT INTO group_members (user_id, group_id, joined_at)
SELECT u.id, g.id, g.created_at + (u.n * interval '3 hours')
FROM groups g JOIN festivals f ON f.id = g.festival_id
JOIN demo_users u ON (g.name = 'Wiesn Crew' AND u.n IN (1,2,3,4,5,7,8))
                  OR (g.name = 'Office Wiesn' AND u.n IN (1,5,6,9,4))
WHERE g.created_by = 'de000000-0000-4000-a000-000000000001';

-- The 2026 crew is a carry-over of 2025 (hides the 'bring your groups' banner).
UPDATE groups g26 SET carried_over_from = g25.id FROM groups g25, festivals f25, festivals f26 WHERE g26.name = 'Wiesn Crew' AND g25.name = 'Wiesn Crew' AND g26.festival_id = f26.id AND f26.short_name = 'oktoberfest-2026' AND g25.festival_id = f25.id AND f25.short_name = 'oktoberfest-2025' AND g26.created_by = 'de000000-0000-4000-a000-000000000001' AND g25.created_by = g26.created_by;

-- ---------- crowd reports (recent ones drive the tent picker) ----------
INSERT INTO tent_crowd_reports (tent_id, festival_id, user_id, crowd_level, wait_time_minutes, created_at)
SELECT t.id, f.id, u.id, r.lvl::crowd_level, r.wait, now() - r.ago
FROM (VALUES
  (2,'Hofbräu-Festzelt','full',45,interval '12 minutes'),
  (3,'Schützen-Festzelt','crowded',15,interval '25 minutes'),
  (7,'Augustiner-Festhalle','crowded',20,interval '18 minutes'),
  (4,'Pschorr-Festzelt Bräurosl','moderate',5,interval '30 minutes'),
  (6,'Schützen-Festzelt','crowded',10,interval '40 minutes'),
  (1,'Schützen-Festzelt','crowded',15,interval '2 hours'),
  (1,'Käfer Wiesn-Schänke','full',30,interval '1 day'),
  (1,'Löwenbräu-Festzelt','moderate',0,interval '2 days'),
  (1,'Hofbräu-Festzelt','full',40,interval '4 days'),
  (1,'Augustiner-Festhalle','crowded',20,interval '5 days')
) AS r(n, tent, lvl, wait, ago)
JOIN demo_users u ON u.n = r.n
JOIN tents t ON t.name = r.tent
JOIN festivals f ON f.short_name = 'oktoberfest-2026';

-- ---------- friends' plans and reservations (feed items) ----------
-- feed_at is forced to now() by a trigger; bypass it so the items are spread out.
SET LOCAL session_replication_role = replica;
INSERT INTO day_plans (id, user_id, festival_id, date, kind, tent_id, note, visible_to_groups,
  start_at, status, reminder_offset_minutes, auto_checkin, created_at, updated_at, feed_at)
SELECT p.id, u.id, f.id, p.day, p.kind, t.id, p.note, true,
  CASE WHEN p.kind = 'reservation' THEN (p.day + p.at) AT TIME ZONE 'Europe/Berlin' END,
  CASE WHEN p.kind = 'reservation' THEN 'confirmed' END,
  CASE WHEN p.kind = 'reservation' THEN 60 END,
  CASE WHEN p.kind = 'reservation' THEN true END,
  now() - p.ago, now() - p.ago, now() - p.ago
FROM (VALUES
  ('de0000a0-0000-4000-a000-000000000001'::uuid, 2, date '2026-09-26', 'reservation', 'Paulaner Festzelt', 'Table for 10, bring cash', time '12:00', interval '35 minutes'),
  ('de0000a0-0000-4000-a000-000000000002'::uuid, 8, date '2026-09-26', 'plan', NULL, NULL, NULL, interval '1 hour 20 minutes'),
  ('de0000a0-0000-4000-a000-000000000003'::uuid, 8, date '2026-09-27', 'plan', NULL, NULL, NULL, interval '1 hour 20 minutes'),
  ('de0000a0-0000-4000-a000-000000000004'::uuid, 5, date '2026-10-03', 'reservation', 'Hofbräu-Festzelt', NULL, time '16:30', interval '5 hours'),
  ('de0000a0-0000-4000-a000-000000000005'::uuid, 3, date '2026-09-27', 'plan', NULL, NULL, NULL, interval '20 hours')
) AS p(id, n, day, kind, tent, note, at, ago)
JOIN demo_users u ON u.n = p.n
LEFT JOIN tents t ON t.name = p.tent
JOIN festivals f ON f.short_name = 'oktoberfest-2026';
SET LOCAL session_replication_role = origin;

INSERT INTO day_plan_companions (plan_id, user_id)
SELECT p.plan_id, u.id FROM (VALUES
  ('de0000a0-0000-4000-a000-000000000002'::uuid, 1), ('de0000a0-0000-4000-a000-000000000002'::uuid, 7),
  ('de0000a0-0000-4000-a000-000000000003'::uuid, 6),
  ('de0000a0-0000-4000-a000-000000000005'::uuid, 2)
) AS p(plan_id, n) JOIN demo_users u ON u.n = p.n;

COMMIT;
