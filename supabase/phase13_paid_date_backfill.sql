-- ═══════════════════════════════════════════════════════════════
-- PHASE 13: Fix revenue-by-date — backfill missing paid_date
-- Run this whole file in the Supabase SQL Editor.
--
-- Root cause: marking an invoice "paid" via the status dropdown never
-- stamped paid_date (now fixed in code). Every invoice already marked
-- paid before this fix has paid_date = NULL, so any report or Aether
-- query filtering "revenue collected this month/week" by paid_date finds
-- nothing — this is exactly why a paid invoice appeared to contribute
-- zero revenue. Best-effort backfill: use issue_date (or updated_at if
-- that's missing) as the paid date for anything already marked paid.
-- ═══════════════════════════════════════════════════════════════

UPDATE invoices
SET paid_date = COALESCE(issue_date, updated_at::date)
WHERE status = 'paid' AND paid_date IS NULL;

CREATE INDEX IF NOT EXISTS invoices_paid_date ON invoices (paid_date) WHERE status = 'paid';

SELECT 'Phase 13 paid_date backfill complete' AS status, count(*) AS invoices_fixed
FROM invoices WHERE status = 'paid' AND paid_date IS NOT NULL;
