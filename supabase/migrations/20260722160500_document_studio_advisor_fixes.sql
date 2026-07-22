-- Follow-up from Supabase performance advisor after Phase 53 was applied.

CREATE INDEX IF NOT EXISTS agency_documents_created_by_idx
  ON agency_documents(created_by);
CREATE INDEX IF NOT EXISTS document_archives_generated_by_idx
  ON document_archives(generated_by);

DROP POLICY IF EXISTS "authorized staff read agency documents" ON agency_documents;
CREATE POLICY "authorized staff read agency documents" ON agency_documents
  FOR SELECT TO authenticated USING (
    is_admin()
    OR has_permission((SELECT auth.uid()), 'documents.write')
    OR created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "document writers create agency documents" ON agency_documents;
CREATE POLICY "document writers create agency documents" ON agency_documents
  FOR INSERT TO authenticated WITH CHECK (
    has_permission((SELECT auth.uid()), 'documents.write')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "document writers update agency documents" ON agency_documents;
CREATE POLICY "document writers update agency documents" ON agency_documents
  FOR UPDATE TO authenticated
  USING (has_permission((SELECT auth.uid()), 'documents.write'))
  WITH CHECK (has_permission((SELECT auth.uid()), 'documents.write'));

DROP POLICY IF EXISTS "document writers delete agency documents" ON agency_documents;
CREATE POLICY "document writers delete agency documents" ON agency_documents
  FOR DELETE TO authenticated
  USING (has_permission((SELECT auth.uid()), 'documents.write'));

DROP POLICY IF EXISTS "authorized staff read document archives" ON document_archives;
CREATE POLICY "authorized staff read document archives" ON document_archives
  FOR SELECT TO authenticated USING (
    is_admin()
    OR has_permission((SELECT auth.uid()), 'finance.read')
    OR has_permission((SELECT auth.uid()), 'documents.write')
  );
