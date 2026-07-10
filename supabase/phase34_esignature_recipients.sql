-- ═══════════════════════════════════════════════════════════════
-- PHASE 34: E-signature recipients — sign with any name/email
-- (clients, employees, or anyone else), token-based signing links,
-- and a completion certificate once every party has signed.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Any number of named recipients per document ──────────────
CREATE TABLE IF NOT EXISTS document_recipients (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id  uuid REFERENCES signable_documents ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  email        text NOT NULL,
  role         text NOT NULL DEFAULT 'signer' CHECK (role IN ('agency', 'client', 'employee', 'other')),
  sign_token   uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, -- personal signing-link token, no login required
  ip_address   text,
  notified_at  timestamptz,
  signed_at    timestamptz, -- set once every field assigned to this recipient is filled
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS document_recipients_document_idx ON document_recipients (document_id);

-- Reads only, staff only — token-holders (who may not have an account at
-- all) are served by service-role API routes that verify the token
-- themselves, same convention as everywhere else in this schema.
CREATE POLICY "staff read document recipients" ON document_recipients FOR SELECT USING (is_staff());

-- ─── 2. Fields now target a specific recipient ────────────────────
ALTER TABLE document_fields ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES document_recipients ON DELETE CASCADE;
ALTER TABLE document_fields ALTER COLUMN assigned_party DROP NOT NULL;

CREATE INDEX IF NOT EXISTS document_fields_recipient_idx ON document_fields (recipient_id);

-- ─── 3. A document no longer has to belong to one CRM client, and
--        tracks its own legal completion certificate once signed ────
ALTER TABLE signable_documents ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE signable_documents ADD COLUMN IF NOT EXISTS completion_certificate_url text;
