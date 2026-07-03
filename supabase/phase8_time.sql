-- ═══════════════════════════════════════════════════════════════
-- PHASE 8 (Build-plan Phase 4): Time tracking
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS time_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  task_id     uuid REFERENCES tasks ON DELETE SET NULL,
  project_id  uuid REFERENCES projects ON DELETE SET NULL,
  client_id   uuid REFERENCES clients ON DELETE SET NULL,
  description text,
  minutes     int NOT NULL DEFAULT 0,
  billable    boolean NOT NULL DEFAULT true,
  started_at  timestamptz,           -- set while a timer is running
  ended_at    timestamptz,           -- null while running
  entry_date  date NOT NULL DEFAULT current_date,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS time_entries_user ON time_entries (user_id, entry_date DESC);

-- Members see & edit their own; managers/admins can read everyone's
CREATE POLICY "read time entries" ON time_entries FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('owner','admin','manager'));
CREATE POLICY "write own time entries" ON time_entries FOR ALL
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

SELECT 'Phase 8 time-tracking migration complete' AS status;
