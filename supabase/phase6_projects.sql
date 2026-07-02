-- ═══════════════════════════════════════════════════════════════
-- PHASE 6 (Build-plan Phase 2): Projects layer — everything links
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Milestones ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  due_date    date,
  done        boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- ─── 2. Project members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  project_id  uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- ─── 3. Link everything to projects ─────────────────────────────
ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects ON DELETE SET NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects ON DELETE SET NULL;
ALTER TABLE expenses   ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects ON DELETE SET NULL;
ALTER TABLE files      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects ON DELETE SET NULL;

-- ─── 4. RLS ─────────────────────────────────────────────────────
CREATE POLICY "staff read milestones" ON milestones FOR SELECT
  USING (is_staff() OR project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT my_client_ids())));
CREATE POLICY "ops write milestones" ON milestones FOR ALL USING (can_write_ops());

CREATE POLICY "staff read project_members" ON project_members FOR SELECT USING (is_staff());
CREATE POLICY "ops write project_members"  ON project_members FOR ALL    USING (can_write_ops());

SELECT 'Phase 6 projects migration complete' AS status;
