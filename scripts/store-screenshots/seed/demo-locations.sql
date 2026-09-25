-- Friends sharing live location near their current tents (Festival Map shot). Expires in 3h.
BEGIN;
DELETE FROM location_points WHERE session_id IN (SELECT id FROM location_sessions WHERE user_id::text LIKE 'de000000-%');
DELETE FROM location_session_members WHERE session_id IN (SELECT id FROM location_sessions WHERE user_id::text LIKE 'de000000-%');
DELETE FROM location_sessions WHERE user_id::text LIKE 'de000000-%';
CREATE TEMP TABLE s ON COMMIT DROP AS
SELECT gen_random_uuid() id, ('de000000-0000-4000-a000-00000000000' || x.n)::uuid user_id, t.latitude + x.dlat lat, t.longitude + x.dlng lng
FROM (VALUES (2,'Hofbräu-Festzelt',0.0002,-0.0001),(3,'Schützen-Festzelt',-0.0001,0.0002),
             (6,'Schützen-Festzelt',0.0002,0.0001),(7,'Augustiner-Festhalle',0.0,-0.0002),
             (4,'Pschorr-Festzelt Bräurosl',0.0001,0.0001)) x(n, tent, dlat, dlng)
JOIN tents t ON t.name = x.tent;
INSERT INTO location_sessions (id, user_id, festival_id, started_at, expires_at, is_active, share_with_friends)
SELECT s.id, s.user_id, f.id, now() - interval '1 hour', now() + interval '3 hours', true, true
FROM s, festivals f WHERE f.short_name = 'oktoberfest-2026';
INSERT INTO location_points (session_id, latitude, longitude, accuracy, recorded_at)
SELECT id, lat, lng, 10, now() - interval '2 minutes' FROM s;
INSERT INTO location_session_members (session_id, group_id)
SELECT s.id, gm.group_id FROM s JOIN group_members gm ON gm.user_id = s.user_id
JOIN groups g ON g.id = gm.group_id JOIN festivals f ON f.id = g.festival_id AND f.short_name = 'oktoberfest-2026';
COMMIT;
