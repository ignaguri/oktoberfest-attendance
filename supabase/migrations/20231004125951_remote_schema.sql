drop view if exists "public"."results";

create or replace view "public"."results" as  SELECT p.username,
    p.full_name,
    u.email,
    count(a.date) AS total_days,
    sum(a.liters) AS total_liters,
    avg((a.liters)::double precision) AS average_liters
   FROM ((profiles p
     LEFT JOIN attendance a ON ((p.id = a.user_id)))
     LEFT JOIN auth.users u ON ((a.user_id = u.id)))
  GROUP BY p.username, p.full_name, u.email;



