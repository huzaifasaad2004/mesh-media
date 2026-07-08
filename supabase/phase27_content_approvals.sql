-- ═══════════════════════════════════════════════════════════════
-- PHASE 27: Content approval workflow — creator → manager review →
-- client approve/decline/comment in the portal (BUILD_PLAN.md §A #2).
-- Run this whole file in the Supabase SQL Editor.
--
-- Deliberately independent of the files-module overhaul (§A #1,
-- not built yet): content is referenced by a plain link
-- (Drive/anything) via file_url, the same external-link pattern
-- already used by clients.drive_folder_url. Revisit once #1 ships.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_items (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id          uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  project_id         uuid REFERENCES projects ON DELETE SET NULL,
  created_by         uuid REFERENCES profiles ON DELETE SET NULL NOT NULL,
  title              text NOT NULL,
  description        text,
  file_url           text,
  status             text NOT NULL DEFAULT 'pending_manager'
                        CHECK (status IN ('pending_manager','manager_rejected','pending_client','client_approved','client_declined')),
  manager_id         uuid REFERENCES profiles ON DELETE SET NULL,
  manager_comment    text,
  manager_decided_at timestamptz,
  client_comment     text,
  client_decided_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS content_items_status ON content_items (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_items_client  ON content_items (client_id);

CREATE TRIGGER content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Reads: managers+ see everything; a creator always sees their own
-- submissions; a member additionally sees items for clients they're
-- assigned to (team visibility on shared accounts); client-portal
-- users only ever see items once they've reached the client-facing
-- stages — internal review (pending_manager / manager_rejected) is
-- never exposed to the client, matching Huzaifa's "employees must
-- never submit directly to a client" requirement.
CREATE POLICY "content read scoped" ON content_items FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager')
    OR created_by = auth.uid()
    OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
    OR (status IN ('pending_client','client_approved','client_declined') AND client_id IN (SELECT my_client_ids()))
  );

-- Insert: any staff member may submit content for a client they can
-- actually see (managers+: any client; member: only assigned clients).
CREATE POLICY "content insert scoped" ON content_items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      my_role() IN ('owner','admin','manager')
      OR (my_role() = 'member' AND client_id IN (SELECT my_assigned_client_ids()))
    )
  );

-- Manager review decisions. Client-side decisions are written via the
-- API's service-role client after an explicit client_contacts
-- ownership check (same pattern as quotations respond) — no client
-- UPDATE policy needed here.
CREATE POLICY "content manager decide" ON content_items FOR UPDATE
  USING (my_role() IN ('owner','admin','manager'));

SELECT 'Phase 27 content-approvals migration complete' AS status;
