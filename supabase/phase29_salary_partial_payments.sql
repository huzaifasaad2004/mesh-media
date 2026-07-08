-- ═══════════════════════════════════════════════════════════════
-- PHASE 29: Allow split/partial salary payments — e.g. 50% advance +
-- 50% two weeks later (BUILD_PLAN.md §C #13). Run this whole file in
-- the Supabase SQL Editor.
--
-- phase14_payroll.sql's UNIQUE (salary_id, period) index assumed one
-- payment fully covers one period, which blocked recording a second
-- payment for the same salary+period entirely. Replaced with a plain
-- (non-unique) index for query performance — idempotency for the
-- automated monthly run now lives in app code (skip a period if ANY
-- payment already exists for it, partial or full — see
-- app/api/salaries/run-recurring/route.ts) instead of the database.
-- ═══════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS salary_payments_salary_period;
CREATE INDEX IF NOT EXISTS salary_payments_salary_period_idx ON salary_payments (salary_id, period);

SELECT 'Phase 29 salary-partial-payments migration complete' AS status;
