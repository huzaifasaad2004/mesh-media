-- ═══════════════════════════════════════════════════════════════
-- PHASE 21: Recurring retainer invoices + smart dunning
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- Opt-in per client — only clients with both a monthly_retainer set AND
-- this flag on get auto-invoiced.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auto_invoice_retainer boolean NOT NULL DEFAULT false;

-- Marks which billing period a retainer invoice covers, so the recurring
-- job can never double-invoice the same client in the same month.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainer_period text;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_client_retainer_period_key
  ON invoices (client_id, retainer_period) WHERE retainer_period IS NOT NULL;

-- Dunning: how far the escalating reminder sequence has gotten, and when
-- the last one went out. Reset to 0 whenever an invoice is paid.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dunning_stage int NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
