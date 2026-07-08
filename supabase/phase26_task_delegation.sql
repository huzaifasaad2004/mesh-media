-- ═══════════════════════════════════════════════════════════════
-- PHASE 26: Task flow — only managers+ create/assign/delete tasks;
-- members may only update the status of tasks already assigned to
-- them (BUILD_PLAN.md §D item 8). Run this whole file in the
-- Supabase SQL Editor.
--
-- Primary enforcement is in the API (app/api/tasks/route.ts and
-- app/api/tasks/[id]/route.ts, which use the service-role client and
-- so bypass RLS by design — see lib/apiAuth.ts). This migration is
-- defense-in-depth for any direct/RLS-scoped access path.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION can_manage_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(my_role() IN ('owner','admin','manager'), false)
$$;

DROP POLICY IF EXISTS "tasks insert ops" ON tasks;
DROP POLICY IF EXISTS "tasks update ops" ON tasks;
DROP POLICY IF EXISTS "tasks delete ops" ON tasks;

CREATE POLICY "tasks insert scoped" ON tasks FOR INSERT
  WITH CHECK (can_manage_tasks());

CREATE POLICY "tasks update scoped" ON tasks FOR UPDATE
  USING (can_manage_tasks() OR (my_role() = 'member' AND assigned_to = auth.uid()));

CREATE POLICY "tasks delete scoped" ON tasks FOR DELETE
  USING (can_manage_tasks());

SELECT 'Phase 26 task-delegation migration complete' AS status;
