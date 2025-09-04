-- Create achievement_events table
CREATE TABLE IF NOT EXISTS achievement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  rarity achievement_rarity_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_notified_at timestamptz NULL,
  group_notified_at timestamptz NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_achievement_events_user_notified ON achievement_events (user_notified_at);
CREATE INDEX IF NOT EXISTS idx_achievement_events_group_notified ON achievement_events (group_notified_at);
CREATE INDEX IF NOT EXISTS idx_achievement_events_festival_created ON achievement_events (festival_id, created_at);

-- RLS
ALTER TABLE achievement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own achievement_events" ON achievement_events;
CREATE POLICY "Users can view their own achievement_events" ON achievement_events
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger to insert into achievement_events after unlock
CREATE OR REPLACE FUNCTION insert_achievement_event_from_unlock()
RETURNS TRIGGER AS $$
DECLARE
  v_rarity achievement_rarity_enum;
BEGIN
  SELECT rarity INTO v_rarity FROM achievements WHERE id = NEW.achievement_id;
  INSERT INTO achievement_events (user_id, festival_id, achievement_id, rarity)
  VALUES (NEW.user_id, NEW.festival_id, NEW.achievement_id, v_rarity);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_achievements_insert_event ON user_achievements;
CREATE TRIGGER trg_user_achievements_insert_event
  AFTER INSERT ON user_achievements
  FOR EACH ROW EXECUTE FUNCTION insert_achievement_event_from_unlock();

-- RPC: due reservation reminders
CREATE OR REPLACE FUNCTION rpc_due_reservation_reminders(p_now timestamptz)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  festival_id uuid,
  tent_id uuid,
  start_at timestamptz,
  reminder_offset_minutes int
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at, r.reminder_offset_minutes
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.status = 'scheduled'
    AND p.reminders_enabled = true
    AND r.reminder_sent_at IS NULL
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) <= p_now;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: due reservation prompts
CREATE OR REPLACE FUNCTION rpc_due_reservation_prompts(p_now timestamptz)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  festival_id uuid,
  tent_id uuid,
  start_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.status = 'scheduled'
    AND p.reminders_enabled = true
    AND r.prompt_sent_at IS NULL
    AND r.start_at <= p_now;
END;
$$ LANGUAGE plpgsql STABLE;
