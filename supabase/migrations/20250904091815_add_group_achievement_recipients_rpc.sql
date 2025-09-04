-- Create RPC function to get group achievement recipients
-- This eliminates the N+1 query pattern in achievement notifications
-- by consolidating multiple queries into a single database call

CREATE OR REPLACE FUNCTION get_group_achievement_recipients(
  p_user_ids UUID[],
  p_festival_ids UUID[]
)
RETURNS TABLE (
  user_id UUID,
  festival_id UUID,
  recipient_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_groups AS (
    -- Get all groups that the users belong to for the specified festivals
    SELECT DISTINCT 
      gm.user_id,
      g.festival_id,
      g.id as group_id
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id = ANY(p_user_ids)
      AND g.festival_id = ANY(p_festival_ids)
  ),
  group_recipients AS (
    -- Get all other members in those groups (excluding the achiever)
    SELECT 
      ug.user_id,
      ug.festival_id,
      ARRAY_AGG(gm2.user_id) as recipient_ids
    FROM user_groups ug
    JOIN group_members gm2 ON gm2.group_id = ug.group_id
    WHERE gm2.user_id != ug.user_id
    GROUP BY ug.user_id, ug.festival_id
  )
  SELECT 
    gr.user_id,
    gr.festival_id,
    gr.recipient_ids
  FROM group_recipients gr
  WHERE array_length(gr.recipient_ids, 1) > 0;
END;
$$;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION get_group_achievement_recipients(UUID[], UUID[]) IS 
'Returns group members who should be notified when a user achieves a rare/epic achievement. 
Eliminates N+1 query pattern by consolidating group membership lookups into a single database call.';
