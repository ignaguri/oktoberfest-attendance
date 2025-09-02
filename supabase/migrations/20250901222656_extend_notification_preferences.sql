-- Extend user_notification_preferences with consolidated toggles
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_notifications_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS achievement_notifications_enabled boolean DEFAULT true;

-- Backfill NULLs to defaults for existing rows
UPDATE user_notification_preferences
SET 
  reminders_enabled = COALESCE(reminders_enabled, true),
  group_notifications_enabled = COALESCE(group_notifications_enabled, true),
  achievement_notifications_enabled = COALESCE(achievement_notifications_enabled, true);

-- Update default creation trigger to include new columns (idempotent behavior)
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_notification_preferences (
    user_id,
    reminders_enabled,
    group_notifications_enabled,
    achievement_notifications_enabled
  )
  VALUES (
    NEW.id,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
