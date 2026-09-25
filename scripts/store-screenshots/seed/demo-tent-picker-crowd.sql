-- ONLY for the tent-picker shot: capture Home first, it gets too busy with these.
INSERT INTO tent_crowd_reports (tent_id, festival_id, user_id, crowd_level, wait_time_minutes, created_at)
SELECT t.id, f.id, ('de000000-0000-4000-a000-00000000000' || r.n)::uuid, r.lvl::crowd_level, r.wait, now() - r.ago
FROM (VALUES
  (5,'Armbrustschützen Festzelt','moderate',5,interval '4 minutes'),
  (9,'Festhalle Schottenhamel','full',60,interval '3 minutes'),
  (8,'Fischer-Vroni','crowded',25,interval '5 minutes'),
  (2,'Hacker-Festzelt','full',50,interval '2 minutes'),
  (6,'Kufflers Weinzelt','empty',0,interval '6 minutes')
) AS r(n, tent, lvl, wait, ago)
JOIN tents t ON t.name = r.tent
JOIN festivals f ON f.short_name = 'oktoberfest-2026';
