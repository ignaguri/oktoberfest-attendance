-- Crowd level enum
CREATE TYPE crowd_level AS ENUM ('empty', 'moderate', 'crowded', 'full');

-- Tent crowd reports
CREATE TABLE tent_crowd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id uuid NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crowd_level crowd_level NOT NULL,
  wait_time_minutes integer CHECK (wait_time_minutes >= 0 AND wait_time_minutes <= 180),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tent_crowd_reports_tent_festival ON tent_crowd_reports(tent_id, festival_id);
CREATE INDEX idx_tent_crowd_reports_created_at ON tent_crowd_reports(created_at);

-- RLS
ALTER TABLE tent_crowd_reports ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can view reports
CREATE POLICY "Users can view crowd reports" ON tent_crowd_reports FOR SELECT TO authenticated USING (true);
-- Users can insert their own reports
CREATE POLICY "Users can create crowd reports" ON tent_crowd_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Users can delete their own reports
CREATE POLICY "Users can delete own reports" ON tent_crowd_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Aggregation view for current crowd status (reports from last 30 minutes)
CREATE OR REPLACE VIEW tent_crowd_status WITH (security_invoker = true) AS
SELECT
  t.id AS tent_id,
  t.name AS tent_name,
  tcr.festival_id,
  COUNT(tcr.id) AS report_count,
  MODE() WITHIN GROUP (ORDER BY tcr.crowd_level) AS crowd_level,
  ROUND(AVG(tcr.wait_time_minutes)) AS avg_wait_minutes,
  MAX(tcr.created_at) AS last_reported_at
FROM tents t
LEFT JOIN tent_crowd_reports tcr ON t.id = tcr.tent_id
  AND tcr.created_at > NOW() - INTERVAL '30 minutes'
GROUP BY t.id, t.name, tcr.festival_id;
