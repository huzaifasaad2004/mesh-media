-- ═══════════════════════════════════════════════════════════════
-- PHASE 7 (Build-plan Phase 3): Client portal — requests + quote loop
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Track quote → invoice conversion ────────────────────────
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_invoice_id uuid REFERENCES invoices ON DELETE SET NULL;

-- ─── 2. Client requests / ticketing ─────────────────────────────
CREATE TABLE IF NOT EXISTS client_requests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  created_by  uuid REFERENCES auth.users ON DELETE SET NULL,
  subject     text NOT NULL,
  body        text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS client_requests_client ON client_requests (client_id, created_at DESC);

DROP TRIGGER IF EXISTS client_requests_updated_at ON client_requests;
CREATE TRIGGER client_requests_updated_at
  BEFORE UPDATE ON client_requests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────────
-- Clients read + create requests for their own company; staff see all
CREATE POLICY "read client_requests" ON client_requests FOR SELECT
  USING (is_staff() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "client insert requests" ON client_requests FOR INSERT
  WITH CHECK (client_id IN (SELECT my_client_ids()) OR can_write_ops());
CREATE POLICY "staff update requests" ON client_requests FOR UPDATE
  USING (can_write_ops());

SELECT 'Phase 7 portal migration complete' AS status;
