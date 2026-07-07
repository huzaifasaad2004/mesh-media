-- ═══════════════════════════════════════════════════════════════
-- PHASE 22: E-signature — upload a document, both agency and client
-- sign it; quotations can be signed at acceptance too.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Signable documents (uploaded contracts/agreements/etc.) ─
CREATE TABLE IF NOT EXISTS signable_documents (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  project_id   uuid REFERENCES projects ON DELETE SET NULL,
  title        text NOT NULL,
  file_url     text NOT NULL,
  storage_path text,
  status       text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partially_signed', 'signed', 'cancelled')),
  created_by   uuid REFERENCES profiles ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE signable_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER signable_documents_updated_at BEFORE UPDATE ON signable_documents
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ─── 2. One signature row per party per document ────────────────
CREATE TABLE IF NOT EXISTS document_signatures (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     uuid REFERENCES signable_documents ON DELETE CASCADE NOT NULL,
  party           text NOT NULL CHECK (party IN ('agency', 'client')),
  signer_name     text NOT NULL,
  signature_data  text, -- base64 PNG of a drawn signature; null if typed-name-only
  signer_user_id  uuid REFERENCES profiles ON DELETE SET NULL,
  ip_address      text,
  signed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, party)
);
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Reads only — all writes go through service-role API routes that already
-- verify the caller (staff for 'agency', a linked client_contacts row for
-- 'client') before touching these tables, same convention as everywhere else.
CREATE POLICY "staff read documents" ON signable_documents FOR SELECT USING (is_staff());
CREATE POLICY "client read own documents" ON signable_documents FOR SELECT
  USING (client_id IN (SELECT my_client_ids()));

CREATE POLICY "staff read document signatures" ON document_signatures FOR SELECT USING (is_staff());
CREATE POLICY "client read own document signatures" ON document_signatures FOR SELECT
  USING (document_id IN (SELECT id FROM signable_documents WHERE client_id IN (SELECT my_client_ids())));

CREATE INDEX IF NOT EXISTS signable_documents_client_idx ON signable_documents (client_id, created_at DESC);

-- ─── 3. Storage bucket for uploaded originals ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('signable-documents', 'signable-documents', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Quotations can carry a signature at acceptance time ─────
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS signature_name text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS signature_data text;
