-- ═══════════════════════════════════════════════════════════════
-- PHASE 25: Restrict the 'member' role to assigned clients/projects/
-- tasks only (BUILD_PLAN.md §D items 7, 9, 10 + the access-control
-- finding under item 2). Run this whole file in the Supabase SQL Editor.
--
-- Scope: SELECT (visibility) only. Write behavior for member is left
-- exactly as it was (can_write_ops()) — task-flow / delegation rules
-- for member (item #8) are a separate follow-up decision, not this
-- migration's concern.
--
-- Every table below previously had a single "FOR ALL USING (can_write_ops())"
-- write policy that (because Postgres RLS policies are OR'd together
-- within the same command) ALSO granted SELECT to anyone can_write_ops()
-- allowed — silently overriding any narrower read policy. Each is split
-- into INSERT/UPDATE/DELETE-only policies here so the new SELECT policy
-- actually takes effect.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Helper functions: what can a 'member' actually see? ────
CREATE OR REPLACE FUNCTION my_assigned_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM tasks WHERE assigned_to = auth.uid() AND client_id IS NOT NULL
  UNION
  SELECT p.client_id FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.assigned_to = auth.uid() AND p.client_id IS NOT NULL
  UNION
  SELECT p.client_id FROM projects p JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = auth.uid() AND p.client_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION my_assigned_project_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM projects WHERE client_id IN (SELECT my_assigned_client_ids())
  UNION
  SELECT project_id FROM project_members WHERE user_id = auth.uid()
  UNION
  SELECT project_id FROM tasks WHERE assigned_to = auth.uid() AND project_id IS NOT NULL
$$;

-- ─── 2. clients ──────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read clients" ON clients;
DROP POLICY IF EXISTS "ops write clients"  ON clients;
CREATE POLICY "clients read scoped" ON clients FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR id IN (SELECT my_client_ids())
    OR (my_role() = 'member' AND id IN (SELECT my_assigned_client_ids()))
  );
CREATE POLICY "clients insert ops" ON clients FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "clients update ops" ON clients FOR UPDATE USING (can_write_ops());
CREATE POLICY "clients delete ops" ON clients FOR DELETE USING (can_write_ops());

-- ─── 3. contacts ─────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read contacts" ON contacts;
DROP POLICY IF EXISTS "ops write contacts"  ON contacts;
CREATE POLICY "contacts read scoped" ON contacts FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
  );
CREATE POLICY "contacts insert ops" ON contacts FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "contacts update ops" ON contacts FOR UPDATE USING (can_write_ops());
CREATE POLICY "contacts delete ops" ON contacts FOR DELETE USING (can_write_ops());

-- ─── 4. client_notes ─────────────────────────────────────────
DROP POLICY IF EXISTS "staff read notes" ON client_notes;
DROP POLICY IF EXISTS "ops write notes"  ON client_notes;
CREATE POLICY "notes read scoped" ON client_notes FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
  );
CREATE POLICY "notes insert ops" ON client_notes FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "notes update ops" ON client_notes FOR UPDATE USING (can_write_ops());
CREATE POLICY "notes delete ops" ON client_notes FOR DELETE USING (can_write_ops());

-- ─── 5. projects ─────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read projects" ON projects;
DROP POLICY IF EXISTS "ops write projects"  ON projects;
CREATE POLICY "projects read scoped" ON projects FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR client_id IN (SELECT my_client_ids())
    OR (my_role() = 'member' AND id IN (SELECT my_assigned_project_ids()))
  );
CREATE POLICY "projects insert ops" ON projects FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "projects update ops" ON projects FOR UPDATE USING (can_write_ops());
CREATE POLICY "projects delete ops" ON projects FOR DELETE USING (can_write_ops());

-- ─── 6. tasks — visibility restricted to assigned-to-me only ───
DROP POLICY IF EXISTS "staff read tasks" ON tasks;
DROP POLICY IF EXISTS "ops write tasks"  ON tasks;
CREATE POLICY "tasks read scoped" ON tasks FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND assigned_to = auth.uid())
  );
CREATE POLICY "tasks insert ops" ON tasks FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "tasks update ops" ON tasks FOR UPDATE USING (can_write_ops());
CREATE POLICY "tasks delete ops" ON tasks FOR DELETE USING (can_write_ops());

-- ─── 7. files ────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read files" ON files;
DROP POLICY IF EXISTS "ops write files"  ON files;
CREATE POLICY "files read scoped" ON files FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR client_id IN (SELECT my_client_ids())
    OR (my_role() = 'member' AND (
      client_id IS NULL
      OR client_id IN (SELECT my_assigned_client_ids())
      OR project_id IN (SELECT my_assigned_project_ids())
    ))
  );
CREATE POLICY "files insert ops" ON files FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "files update ops" ON files FOR UPDATE USING (can_write_ops());
CREATE POLICY "files delete ops" ON files FOR DELETE USING (can_write_ops());

-- ─── 8. contracts ────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read contracts" ON contracts;
DROP POLICY IF EXISTS "ops write contracts"  ON contracts;
CREATE POLICY "contracts read scoped" ON contracts FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR client_id IN (SELECT my_client_ids())
    OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
  );
CREATE POLICY "contracts insert ops" ON contracts FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "contracts update ops" ON contracts FOR UPDATE USING (can_write_ops());
CREATE POLICY "contracts delete ops" ON contracts FOR DELETE USING (can_write_ops());

-- ─── 9. milestones ───────────────────────────────────────────
DROP POLICY IF EXISTS "staff read milestones" ON milestones;
DROP POLICY IF EXISTS "ops write milestones"  ON milestones;
CREATE POLICY "milestones read scoped" ON milestones FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT my_client_ids()))
    OR (my_role() = 'member' AND project_id IN (SELECT my_assigned_project_ids()))
  );
CREATE POLICY "milestones insert ops" ON milestones FOR INSERT WITH CHECK (can_write_ops());
CREATE POLICY "milestones update ops" ON milestones FOR UPDATE USING (can_write_ops());
CREATE POLICY "milestones delete ops" ON milestones FOR DELETE USING (can_write_ops());

SELECT 'Phase 25 member-scoping migration complete' AS status;
