-- ═══════════════════════════════════════════════════════════════
-- PHASE 40: Tighten 'member' role — no client/contract writes, and
-- an explicit "send to manager" step on content submissions.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. clients — writes restricted to manager+ (was can_write_ops(),
--        which wrongly included 'member') ─────────────────────────
DROP POLICY IF EXISTS "clients insert ops" ON clients;
DROP POLICY IF EXISTS "clients update ops" ON clients;
DROP POLICY IF EXISTS "clients delete ops" ON clients;
CREATE POLICY "clients insert managers" ON clients FOR INSERT WITH CHECK (my_role() IN ('owner','admin','manager'));
CREATE POLICY "clients update managers" ON clients FOR UPDATE USING (my_role() IN ('owner','admin','manager'));
CREATE POLICY "clients delete managers" ON clients FOR DELETE USING (my_role() IN ('owner','admin','manager'));

-- ─── 2. contracts — same fix ────────────────────────────────────
DROP POLICY IF EXISTS "contracts insert ops" ON contracts;
DROP POLICY IF EXISTS "contracts update ops" ON contracts;
DROP POLICY IF EXISTS "contracts delete ops" ON contracts;
CREATE POLICY "contracts insert managers" ON contracts FOR INSERT WITH CHECK (my_role() IN ('owner','admin','manager'));
CREATE POLICY "contracts update managers" ON contracts FOR UPDATE USING (my_role() IN ('owner','admin','manager'));
CREATE POLICY "contracts delete managers" ON contracts FOR DELETE USING (my_role() IN ('owner','admin','manager'));

-- ─── 3. content_items — explicit "send to manager" at submission ──
-- assigned_manager_id = who the creator picked when submitting (shown
-- in the UI as "Sent to: Abid"); manager_id (existing column) stays
-- "who actually reviewed it" — usually the same person, but any
-- manager can still pick up an unclaimed item.
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS assigned_manager_id uuid REFERENCES profiles ON DELETE SET NULL;

-- ─── 4. Documents — a 'member' should only see documents that are
--        theirs (uploaded by them), tied to a client/project they're
--        assigned to, or ones they're personally a named signer on.
--        Owner/admin/manager/viewer keep full visibility as before.
CREATE OR REPLACE FUNCTION my_assigned_document_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM signable_documents WHERE created_by = auth.uid()
  UNION
  SELECT id FROM signable_documents WHERE client_id IN (SELECT my_assigned_client_ids())
  UNION
  SELECT id FROM signable_documents WHERE project_id IN (SELECT my_assigned_project_ids())
  UNION
  SELECT dr.document_id FROM document_recipients dr
    JOIN profiles p ON p.id = auth.uid()
    WHERE lower(dr.email) = lower(p.email)
$$;

DROP POLICY IF EXISTS "staff read documents" ON signable_documents;
CREATE POLICY "documents read scoped" ON signable_documents FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND id IN (SELECT my_assigned_document_ids()))
  );

DROP POLICY IF EXISTS "staff read document signatures" ON document_signatures;
CREATE POLICY "document signatures read scoped" ON document_signatures FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND document_id IN (SELECT my_assigned_document_ids()))
  );

DROP POLICY IF EXISTS "staff read document fields" ON document_fields;
CREATE POLICY "document fields read scoped" ON document_fields FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND document_id IN (SELECT my_assigned_document_ids()))
  );

DROP POLICY IF EXISTS "staff read document recipients" ON document_recipients;
CREATE POLICY "document recipients read scoped" ON document_recipients FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR (my_role() = 'member' AND document_id IN (SELECT my_assigned_document_ids()))
  );

-- ─── 5. documents.write was wrongly defaulted to 'member' (it mirrored
--        the old flat OPS_WRITE group) — uploading/editing/deleting any
--        company document is a manager+ action, same as clients/contracts.
DELETE FROM role_permissions WHERE role = 'member' AND permission = 'documents.write';

SELECT 'Phase 40 member-restrictions migration complete' AS status;
