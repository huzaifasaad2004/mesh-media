-- ═══════════════════════════════════════════════════════════════
-- PHASE 32: File module overhaul — real upload (small files to
-- Storage) + Drive links (large files) + client-portal visibility
-- flag (BUILD_PLAN.md §A #1). Run this whole file in the Supabase
-- SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE files ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

-- Client-portal visibility: a client only ever sees files explicitly
-- marked client_visible, on top of the existing client_id scoping.
DROP POLICY IF EXISTS "files read scoped" ON files;
CREATE POLICY "files read scoped" ON files FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (client_id IN (SELECT my_client_ids()) AND client_visible = true)
    OR (my_role() = 'member' AND (
      client_id IS NULL
      OR client_id IN (SELECT my_assigned_client_ids())
      OR project_id IN (SELECT my_assigned_project_ids())
    ))
  );

SELECT 'Phase 32 files-module migration complete' AS status;
