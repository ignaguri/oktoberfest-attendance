create or replace view "public"."results" as  SELECT p.username,
    p.full_name,
    p.avatar_url,
    u.email,
    agg.total_days,
    agg.total_liters,
    agg.average_liters
   FROM ((profiles p
     LEFT JOIN auth.users u ON ((p.id = u.id)))
     LEFT JOIN ( SELECT a.user_id,
            count(a.date) AS total_days,
            sum(a.liters) AS total_liters,
            avg((a.liters)::double precision) AS average_liters
           FROM attendance a
          GROUP BY a.user_id
         HAVING (count(a.date) > 0)) agg ON ((p.id = agg.user_id)))
  WHERE (agg.total_days > 0);



