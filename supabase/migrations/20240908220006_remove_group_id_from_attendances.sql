DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW
  public.leaderboard AS
SELECT
  u.id AS user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  COUNT(DISTINCT a.date) AS days_attended,
  COALESCE(AVG(a.beer_count), 0::NUMERIC) AS avg_beers,
  COALESCE(SUM(a.beer_count), 0::BIGINT) AS total_beers
FROM
  auth.users u
  JOIN group_members gm ON u.id = gm.user_id
  JOIN GROUPS g ON gm.group_id = g.id
  LEFT JOIN attendances a ON u.id = a.user_id
  JOIN profiles p ON u.id = p.id
WHERE
  (
    EXISTS (
      SELECT
        1
      FROM
        group_members
      WHERE
        group_members.group_id = g.id
        AND group_members.user_id = (
          SELECT
            auth.uid () AS uid
        )
    )
  )
GROUP BY
  u.id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.id,
  g.name;

DROP POLICY IF EXISTS "Users can view own and group members' attendance" ON "public"."attendances";
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and group members' attendance" ON public.attendances FOR
SELECT
  USING (
    user_id = auth.uid ()
    OR user_id IN (
      SELECT
        gm.user_id
      FROM
        public.group_members gm
      WHERE
        gm.group_id IN (
          SELECT
            g.id
          FROM
            public.groups g
            JOIN public.group_members gm2 ON g.id = gm2.group_id
          WHERE
            gm2.user_id = auth.uid ()
        )
    )
  );

ALTER TABLE public.attendances FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendances
DROP COLUMN group_id;