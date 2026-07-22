-- Phase 53: permanent PDF archive + branded Document Studio.

CREATE TABLE IF NOT EXISTS agency_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL DEFAULT 'letter'
    CHECK (document_type IN ('letter', 'proposal', 'plan', 'scope', 'report')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'sent', 'archived')),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_title text,
  company_name text,
  address_line text,
  subject text NOT NULL DEFAULT '',
  salutation_name text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  closing text NOT NULL DEFAULT 'Warm regards,',
  signatory_name text NOT NULL DEFAULT 'Huzaifa Bin Saad',
  signatory_role text NOT NULL DEFAULT 'FOUNDER · MESHMEDIA FOR MARKETING AND PR',
  template_key text NOT NULL DEFAULT 'meshmedia-letterhead-v1',
  pdf_storage_path text,
  docx_storage_path text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_documents_created_at_idx
  ON agency_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS agency_documents_client_idx
  ON agency_documents(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_documents_created_by_idx
  ON agency_documents(created_by);

ALTER TABLE agency_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized staff read agency documents" ON agency_documents
  FOR SELECT TO authenticated USING (
    is_admin()
    OR has_permission((SELECT auth.uid()), 'documents.write')
    OR created_by = (SELECT auth.uid())
  );
CREATE POLICY "document writers create agency documents" ON agency_documents
  FOR INSERT TO authenticated WITH CHECK (
    has_permission((SELECT auth.uid()), 'documents.write')
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY "document writers update agency documents" ON agency_documents
  FOR UPDATE TO authenticated USING (has_permission((SELECT auth.uid()), 'documents.write'))
  WITH CHECK (has_permission((SELECT auth.uid()), 'documents.write'));
CREATE POLICY "document writers delete agency documents" ON agency_documents
  FOR DELETE TO authenticated USING (has_permission((SELECT auth.uid()), 'documents.write'));

CREATE TABLE IF NOT EXISTS document_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('invoice', 'quotation', 'agency_document')),
  entity_id uuid NOT NULL,
  document_number text NOT NULL,
  client_name text,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS document_archives_generated_at_idx
  ON document_archives(generated_at DESC);
CREATE INDEX IF NOT EXISTS document_archives_generated_by_idx
  ON document_archives(generated_by);

ALTER TABLE document_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized staff read document archives" ON document_archives
  FOR SELECT TO authenticated USING (
    is_admin()
    OR has_permission((SELECT auth.uid()), 'finance.read')
    OR has_permission((SELECT auth.uid()), 'documents.write')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-archive',
  'document-archive',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

GRANT SELECT, INSERT, UPDATE, DELETE ON agency_documents TO authenticated;
GRANT SELECT ON document_archives TO authenticated;

SELECT 'Document Studio and archive schema ready' AS status;
