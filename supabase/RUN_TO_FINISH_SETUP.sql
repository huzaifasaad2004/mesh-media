-- ═══════════════════════════════════════════════════════════════
-- FINAL CATCH-UP — the only 3 things still missing from your database.
-- (Verified against your live schema — everything else is already applied.)
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Per-person permission overrides (powers Team → Manage Access) ──────────
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  permission text REFERENCES permissions ON DELETE CASCADE NOT NULL,
  granted    boolean NOT NULL,
  updated_by uuid REFERENCES profiles ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own or admin user_permissions" ON user_permissions;
CREATE POLICY "read own or admin user_permissions" ON user_permissions FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "admin write user_permissions" ON user_permissions;
CREATE POLICY "admin write user_permissions" ON user_permissions FOR ALL
  USING (is_admin());

-- 2. Password-set flag for invited teammates ────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT true;

-- 3. Recurring-payroll dedup + permission-driven payroll access ──────────────
ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS period text; -- 'YYYY-MM'
CREATE UNIQUE INDEX IF NOT EXISTS salary_payments_salary_period
  ON salary_payments (salary_id, period) WHERE period IS NOT NULL;

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

SELECT 'Setup complete — Manage Access, invites, and recurring payroll are now live' AS status;
