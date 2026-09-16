-- Overlap push for day plans: a per-user toggle, a dedupe ledger, and the
-- recipient lookup the API runs with the service role.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS friend_plans_enabled boolean DEFAULT true;

-- One row per (recipient, actor, day) ever notified. Inserting with
-- ON CONFLICT DO NOTHING is the dedupe: toggling a plan off and on again
-- cannot notify the same person twice.
CREATE TABLE public.day_plan_overlap_notifications (
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_id, actor_id, festival_id, date)
);

ALTER TABLE public.day_plan_overlap_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.day_plan_overlap_notifications FROM anon, authenticated;
GRANT ALL ON public.day_plan_overlap_notifications TO service_role;

-- Everyone who marked the same day and can see the actor's plans: friends, or
-- members of a group shared with the actor in that festival.
--
-- is_friend() cannot be used here. It returns false whenever auth.uid() is
-- null, which is always the case for the service role that calls this.
CREATE OR REPLACE FUNCTION public.get_day_plan_overlap_recipients(
  p_actor_id uuid,
  p_festival_id uuid,
  p_date date
)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT dp.user_id
  FROM public.day_plans dp
  WHERE dp.festival_id = p_festival_id
    AND dp.date = p_date
    AND dp.user_id <> p_actor_id
    AND (dp.status IS NULL OR dp.status NOT IN ('cancelled', 'expired'))
    AND (
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = p_actor_id AND f.addressee_id = dp.user_id)
            OR (f.requester_id = dp.user_id AND f.addressee_id = p_actor_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.v_user_shared_group_members v
        WHERE v.owner_id = p_actor_id
          AND v.viewer_id = dp.user_id
          AND v.festival_id = p_festival_id
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_day_plan_overlap_recipients(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_day_plan_overlap_recipients(uuid, uuid, date) TO service_role;
