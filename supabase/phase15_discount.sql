-- ═══════════════════════════════════════════════════════════════
-- PHASE 15: Discounts on invoices & quotations
-- (VAT already has subtotal/tax_rate/tax_amount columns from earlier
--  migrations — this just adds discount support alongside it.)
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none'
  CHECK (discount_type IN ('none', 'percent', 'flat'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none'
  CHECK (discount_type IN ('none', 'percent', 'flat'));
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) NOT NULL DEFAULT 0;

SELECT 'Phase 15 discount migration complete' AS status;
