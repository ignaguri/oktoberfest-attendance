-- One row per user per festival day: a plan to go, or a tent reservation.
--
-- Replaces public.reservations. That table is left in place (unused by the
-- API from this release on) as the rollback path, and a follow-up migration
-- drops it once the release has settled.

CREATE TABLE public.day_plans (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('plan', 'reservation')),
  tent_id uuid REFERENCES public.tents(id) ON DELETE RESTRICT,
  -- 500 matches the legacy /reservations input limit; new plan input is capped
  -- at 200 in the API.
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  visible_to_groups boolean NOT NULL DEFAULT true,
  start_at timestamptz,
  end_at timestamptz,
  -- 'completed' is written by POST /attendance/check-in/{reservationId}.
  status text CHECK (
    status IS NULL
    OR status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired')
  ),
  reminder_offset_minutes integer,
  reminder_sent_at timestamptz,
  prompt_sent_at timestamptz,
  processed_at timestamptz,
  auto_checkin boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT day_plans_reservation_fields CHECK (
    kind = 'plan'
    OR (
      tent_id IS NOT NULL
      AND start_at IS NOT NULL
      AND status IS NOT NULL
      AND reminder_offset_minutes IS NOT NULL
      AND auto_checkin IS NOT NULL
    )
  ),
  CONSTRAINT day_plans_plan_fields CHECK (
    kind = 'reservation'
    OR (
      start_at IS NULL
      AND end_at IS NULL
      AND status IS NULL
      AND reminder_offset_minutes IS NULL
      AND reminder_sent_at IS NULL
      AND prompt_sent_at IS NULL
      AND processed_at IS NULL
      AND auto_checkin IS NULL
    )
  )
);

-- One status per day. A cancelled reservation is history and frees the day.
CREATE UNIQUE INDEX day_plans_one_active_per_day
  ON public.day_plans (user_id, festival_id, date)
  WHERE status IS DISTINCT FROM 'cancelled';

CREATE INDEX idx_day_plans_festival_date ON public.day_plans (festival_id, date);
CREATE INDEX idx_day_plans_festival_start_at ON public.day_plans (festival_id, start_at);
CREATE INDEX idx_day_plans_status_start_at ON public.day_plans (status, start_at);
CREATE INDEX idx_day_plans_user_start_at ON public.day_plans (user_id, start_at);
CREATE INDEX idx_day_plans_tent ON public.day_plans (tent_id);

CREATE TRIGGER update_day_plans_updated_at
  BEFORE UPDATE ON public.day_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.day_plans FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_plans TO authenticated;
GRANT ALL ON public.day_plans TO service_role;

CREATE POLICY "Users can view own day plans"
  ON public.day_plans FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own day plans"
  ON public.day_plans FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own day plans"
  ON public.day_plans FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own day plans"
  ON public.day_plans FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Same audience as reservations had (20260317150001): friends, or members of a
-- group shared in that festival, and only rows marked visible.
CREATE POLICY "Friends and group members can view visible day plans"
  ON public.day_plans FOR SELECT TO authenticated
  USING (
    visible_to_groups = true
    AND (
      EXISTS (
        SELECT 1 FROM public.v_user_shared_group_members v
        WHERE v.owner_id = day_plans.user_id
          AND v.viewer_id = (SELECT auth.uid())
          AND v.festival_id = day_plans.festival_id
      )
      OR public.is_friend((SELECT auth.uid()), day_plans.user_id)
    )
  );

-- Carry every reservation over with its id, so push deep links already sent
-- (?reservationId=...) keep resolving.
INSERT INTO public.day_plans (
  id, user_id, festival_id, date, kind, tent_id, note, visible_to_groups,
  start_at, end_at, status, reminder_offset_minutes, reminder_sent_at,
  prompt_sent_at, processed_at, auto_checkin, created_at, updated_at
)
SELECT
  r.id, r.user_id, r.festival_id, (r.start_at AT TIME ZONE f.timezone)::date, 'reservation',
  r.tent_id, r.note, r.visible_to_groups, r.start_at, r.end_at, r.status,
  r.reminder_offset_minutes, r.reminder_sent_at, r.prompt_sent_at, r.processed_at,
  r.auto_checkin, r.created_at, r.updated_at
FROM public.reservations r
JOIN public.festivals f ON f.id = r.festival_id
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM day_plans r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  JOIN festivals f ON f.id = r.festival_id
  WHERE r.kind = 'reservation'
    AND r.status IN ('pending', 'confirmed')
    AND p.reminders_enabled = true
    AND r.prompt_sent_at IS NULL
    AND r.start_at <= p_now
    -- Skip if user already has attendance for the festival date
    AND NOT EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = r.user_id
        AND a.festival_id = r.festival_id
        AND a.date = DATE(r.start_at AT TIME ZONE f.timezone)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone, reminder_offset_minutes integer)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at, r.reminder_offset_minutes
  FROM day_plans r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.kind = 'reservation'
    AND r.status IN ('pending', 'confirmed')
    AND p.reminders_enabled = true
    AND r.reminder_sent_at IS NULL
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) <= p_now;
END;
$$;

-- Only the scheduler cron calls these, with the service role.
REVOKE EXECUTE ON FUNCTION public.rpc_due_reservation_prompts(timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_due_reservation_reminders(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_due_reservation_prompts(timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_due_reservation_reminders(timestamp with time zone) TO service_role;
