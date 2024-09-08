DROP VIEW leaderboard

CREATE OR REPLACE VIEW
  public.leaderboard AS
SELECT
  u.id AS user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.id AS group_id,
  g.name AS group_name,
  COUNT(DISTINCT a.date) AS days_attended,
  COALESCE(AVG(a.beer_count), (0)::NUMERIC) AS avg_beers,
  COALESCE(SUM(a.beer_count), (0)::BIGINT) AS total_beers
FROM
  auth.users u
  JOIN group_members gm ON u.id = gm.user_id
  JOIN GROUPS g ON gm.group_id = g.id
  LEFT JOIN attendances a ON u.id = a.user_id
  JOIN profiles p ON u.id = p.id
WHERE
  gm.group_id = g.id
  AND EXISTS (
    SELECT
      1
    FROM
      group_members
    WHERE
      group_members.group_id = g.id
      AND group_members.user_id = (
        SELECT
          auth.uid ()
      )
  )
GROUP BY
  u.id,
  p.username,
  p.full_name,
  p.avatar_url,
  g.id,
  g.name;
