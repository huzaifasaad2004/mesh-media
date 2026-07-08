-- ═══════════════════════════════════════════════════════════════
-- PHASE 28: Per-user email notification preferences + the plumbing
-- to actually send email at existing notification points
-- (BUILD_PLAN.md §A #3). Run this whole file in the Supabase SQL Editor.
--
-- Default-enabled model: no row for a (user, category) pair means
-- email is ON — a row only exists once someone opts out. This way
-- nothing new needs seeding for every existing user.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  category      text NOT NULL CHECK (category IN ('task_assignment','approval_request','content_review','critical_alert')),
  email_enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, category)
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs read"  ON notification_preferences FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "own prefs write" ON notification_preferences FOR ALL    USING (user_id = auth.uid());

SELECT 'Phase 28 notification-preferences migration complete' AS status;
