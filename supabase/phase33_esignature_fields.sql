-- ═══════════════════════════════════════════════════════════════
-- PHASE 33: E-signature field placement — drag-and-place
-- signature/name/date fields on an uploaded document, plus a merged
-- flattened PDF once every field is filled in.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Placed fields on a document ──────────────────────────────
-- Coordinates are stored as fractions of page width/height (0–1), not
-- pixels, so they stay correct regardless of what size the PDF is
-- rendered at on the placing/signing UI.
CREATE TABLE IF NOT EXISTS document_fields (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     uuid REFERENCES signable_documents ON DELETE CASCADE NOT NULL,
  page_number     int NOT NULL CHECK (page_number >= 1),
  field_type      text NOT NULL CHECK (field_type IN ('signature', 'name', 'date')),
  assigned_party  text NOT NULL CHECK (assigned_party IN ('agency', 'client')),
  x               numeric NOT NULL CHECK (x >= 0 AND x <= 1),
  y               numeric NOT NULL CHECK (y >= 0 AND y <= 1),
  width           numeric NOT NULL CHECK (width > 0 AND width <= 1),
  height          numeric NOT NULL CHECK (height > 0 AND height <= 1),
  value           text, -- base64 PNG (signature) or plain text (name/date); null until filled
  filled_at       timestamptz,
  filled_by       uuid REFERENCES profiles ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS document_fields_document_idx ON document_fields (document_id, page_number);

-- Reads only — same convention as phase22: all writes go through
-- service-role API routes that verify the caller first (staff placing
-- fields at upload time; the assigned party filling their own fields).
CREATE POLICY "staff read document fields" ON document_fields FOR SELECT USING (is_staff());
CREATE POLICY "client read own document fields" ON document_fields FOR SELECT
  USING (document_id IN (SELECT id FROM signable_documents WHERE client_id IN (SELECT my_client_ids())));

-- ─── 2. Track the flattened, merged output on the document itself ─
ALTER TABLE signable_documents ADD COLUMN IF NOT EXISTS merged_file_url text;
ALTER TABLE signable_documents ADD COLUMN IF NOT EXISTS page_count int;

-- 'fields_pending' = fields have been placed but not all filled yet;
-- existing statuses ('sent','partially_signed','signed','cancelled')
-- keep meaning what they already do for documents with no placed
-- fields (the old whole-document signature flow in document_signatures
-- keeps working untouched for those).
ALTER TABLE signable_documents DROP CONSTRAINT IF EXISTS signable_documents_status_check;
ALTER TABLE signable_documents ADD CONSTRAINT signable_documents_status_check
  CHECK (status IN ('sent', 'fields_pending', 'partially_signed', 'signed', 'cancelled'));
