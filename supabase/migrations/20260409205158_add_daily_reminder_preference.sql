ALTER TABLE user_notification_preferences
  ADD COLUMN daily_reminder_enabled boolean NOT NULL DEFAULT true;
