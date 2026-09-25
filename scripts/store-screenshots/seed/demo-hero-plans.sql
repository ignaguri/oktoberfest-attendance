-- Sophie's own upcoming plan + reservation (calendar legend states).
DELETE FROM day_plans WHERE user_id = 'de000000-0000-4000-a000-000000000001';
INSERT INTO day_plans (user_id, festival_id, date, kind, tent_id, note, visible_to_groups, start_at, status, reminder_offset_minutes, auto_checkin)
SELECT 'de000000-0000-4000-a000-000000000001', f.id, d.day, d.kind, t.id, d.note, true,
  CASE WHEN d.kind = 'reservation' THEN (d.day + time '16:30') AT TIME ZONE 'Europe/Berlin' END,
  CASE WHEN d.kind = 'reservation' THEN 'confirmed' END,
  CASE WHEN d.kind = 'reservation' THEN 60 END,
  CASE WHEN d.kind = 'reservation' THEN true END
FROM (VALUES (date '2026-09-26', 'plan', NULL, NULL), (date '2026-10-03', 'reservation', 'Hofbräu-Festzelt', 'With Tom''s crew')) d(day, kind, tent, note)
JOIN festivals f ON f.short_name = 'oktoberfest-2026'
LEFT JOIN tents t ON t.name = d.tent;
