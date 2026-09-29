-- Document Studio contracts: a 'contract' document type whose PDF ends in a
-- signature page, sendable straight to e-signature (signable_documents) with
-- the agency + client signature boxes pre-placed.
-- Safe to re-run.

ALTER TABLE agency_documents DROP CONSTRAINT IF EXISTS agency_documents_document_type_check;
ALTER TABLE agency_documents ADD CONSTRAINT agency_documents_document_type_check
  CHECK (document_type IN ('letter', 'proposal', 'plan', 'scope', 'report', 'contract'));

-- The e-signature copy created from this studio document (latest send).
ALTER TABLE agency_documents ADD COLUMN IF NOT EXISTS signable_document_id uuid
  REFERENCES signable_documents(id) ON DELETE SET NULL;

SELECT 'Document Studio contracts ready' AS status;
