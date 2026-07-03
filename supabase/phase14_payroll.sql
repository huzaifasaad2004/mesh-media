-- ═══════════════════════════════════════════════════════════════
-- PHASE 14: Payroll overhaul — recurring pay, real permission-gated
-- access, multi-currency (PKR for Pakistan-based team members etc.)
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Track which pay period a payment covers (dedup for recurring runs) ──
ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS period text; -- 'YYYY-MM'
CREATE UNIQUE INDEX IF NOT EXISTS salary_payments_salary_period
  ON salary_payments (salary_id, period) WHERE period IS NOT NULL;

-- ─── 2. Generic permission check usable from RLS (mirrors the app's
--        effective-permission logic: an explicit override always wins,
--        otherwise fall back to the role's default) ──────────────────
CREATE OR REPLACE FUNCTION has_permission(uid uuid, perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT granted FROM user_permissions WHERE user_id = uid AND permission = perm),
    EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN profiles p ON p.role = rp.role
      WHERE p.id = uid AND rp.permission = perm
    ),
    false
  )
$$;

-- ─── 3. Payroll RLS now driven by the real permission (so a manager can
--        be granted payroll.write via Manage Access without becoming a
--        full admin) instead of being hard-locked to admins only ──────
DROP POLICY IF EXISTS "payroll read salaries" ON salaries;
CREATE POLICY "payroll read salaries" ON salaries FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'payroll.write') OR profile_id = auth.uid());

DROP POLICY IF EXISTS "payroll write salaries" ON salaries;
CREATE POLICY "payroll write salaries" ON salaries FOR ALL
  USING (has_permission(auth.uid(), 'payroll.write'));

DROP POLICY IF EXISTS "payroll read payments" ON salary_payments;
CREATE POLICY "payroll read payments" ON salary_payments FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'payroll.write') OR profile_id = auth.uid());

DROP POLICY IF EXISTS "payroll write payments" ON salary_payments;
CREATE POLICY "payroll write payments" ON salary_payments FOR ALL
  USING (has_permission(auth.uid(), 'payroll.write'));

SELECT 'Phase 14 payroll migration complete' AS status;
