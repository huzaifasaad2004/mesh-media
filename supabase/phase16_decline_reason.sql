-- ═══════════════════════════════════════════════════════════════
-- PHASE 16: Quotation decline reason + status integrity
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS decided_at timestamptz;

SELECT 'Phase 16 decline-reason migration complete' AS status;
