-- ═══════════════════════════════════════════════════════════════
-- PHASE 31: Partial/split invoice payments — record which date and
-- amount was paid, support multiple payments per invoice. Run this
-- whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','paid','partially_paid','overdue','cancelled'));

-- Denormalized running total so every "outstanding balance" query across the
-- app can do `total - amount_paid` without joining invoice_payments.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;
UPDATE invoices SET amount_paid = total WHERE status = 'paid';

CREATE TABLE IF NOT EXISTS invoice_payments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id    uuid REFERENCES invoices ON DELETE CASCADE NOT NULL,
  amount        numeric(10,2) NOT NULL,
  payment_date  date NOT NULL DEFAULT current_date,
  notes         text,
  created_by    uuid REFERENCES profiles ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS invoice_payments_invoice ON invoice_payments (invoice_id);

-- Same read pattern as invoices itself: finance roles + the owning client.
CREATE POLICY "finance read invoice_payments" ON invoice_payments FOR SELECT
  USING (can_finance() OR invoice_id IN (SELECT id FROM invoices WHERE client_id IN (SELECT my_client_ids())));
CREATE POLICY "finance write invoice_payments" ON invoice_payments FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

SELECT 'Phase 31 invoice-partial-payments migration complete' AS status;
