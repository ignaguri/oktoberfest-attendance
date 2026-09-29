-- Analytics events: signed-in usage events (screens, sheets, prompts, tutorial,
-- empty states, errors), written by POST /v1/events.
--
-- Access model matches analytics_dashboard_v0: nothing is reachable by anon or
-- authenticated. The API validates events against the shared catalog
-- (packages/shared/src/analytics/events.ts) and inserts through
-- analytics_record_events with the service-role client. Supabase default
-- privileges grant new functions to anon and authenticated directly, so both
-- roles are revoked by name.

CREATE TABLE IF NOT EXISTS analytics.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  platform text,
  app_version text
);

CREATE INDEX IF NOT EXISTS events_user_id_occurred_at_idx
  ON analytics.events (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS events_name_occurred_at_idx
  ON analytics.events (name, occurred_at);

-- No policies: RLS on with nothing granted is a second lock behind the REVOKE.
ALTER TABLE analytics.events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics.events FROM PUBLIC, anon, authenticated;
GRANT ALL ON analytics.events TO service_role;

COMMENT ON TABLE analytics.events IS
  'Signed-in usage events from the apps (POST /v1/events). Exposure, intent and abandonment only: actions that already have a domain row (drinks, attendances, photos, groups) are not duplicated here. Join through analytics.real_users for any count. Kept 13 months (cron job analytics-events-retention).';
COMMENT ON COLUMN analytics.events.user_id IS 'From the auth token, never from the request body. Deleting the account deletes its events.';
COMMENT ON COLUMN analytics.events.name IS 'One of EVENT_NAMES in packages/shared/src/analytics/events.ts. No CHECK on purpose: adding an event needs no migration.';
COMMENT ON COLUMN analytics.events.props IS 'Flat props validated by that event''s schema. Enums, booleans, small integers and normalized routes only; no free text or personal data.';
COMMENT ON COLUMN analytics.events.occurred_at IS 'Client clock, clamped by the API to [received - 24h, received].';
COMMENT ON COLUMN analytics.events.session_id IS 'Per app session, generated in memory on the device and never persisted. Rotates after 30 minutes in the background.';
COMMENT ON COLUMN analytics.events.platform IS 'X-Client-Platform: ios, android or web. NULL when absent or unrecognized.';
COMMENT ON COLUMN analytics.events.app_version IS 'X-Client-Version.';

CREATE OR REPLACE FUNCTION public.analytics_record_events(
  p_user_id uuid,
  p_events jsonb,
  p_platform text DEFAULT NULL,
  p_app_version text DEFAULT NULL
) RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH inserted AS (
    INSERT INTO analytics.events (user_id, name, props, occurred_at, session_id, platform, app_version)
    SELECT
      p_user_id,
      e.name,
      coalesce(e.props, '{}'::jsonb),
      e.occurred_at,
      e.session_id,
      p_platform,
      p_app_version
    FROM jsonb_to_recordset(p_events) AS e(name text, props jsonb, occurred_at timestamptz, session_id uuid)
    RETURNING 1
  )
  SELECT count(*)::integer FROM inserted;
$$;

REVOKE ALL ON FUNCTION public.analytics_record_events(uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_record_events(uuid, jsonb, text, text) TO service_role;

COMMENT ON FUNCTION public.analytics_record_events(uuid, jsonb, text, text) IS
  'Inserts already-validated events for one user; returns the number inserted. Called only by POST /v1/events through the service-role client. It lives in public only because PostgREST does not expose analytics. service_role only.';

-- Retention: raw events for 13 months (one festival year plus a margin).
-- pg_cron is already enabled on production; this is a no-op there.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- cron.schedule upserts by job name, so re-running this migration is safe.
SELECT cron.schedule(
  'analytics-events-retention',
  '0 3 1 * *',
  $cron$DELETE FROM analytics.events WHERE occurred_at < now() - interval '13 months'$cron$
);
