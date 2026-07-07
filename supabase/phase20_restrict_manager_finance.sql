-- ═══════════════════════════════════════════════════════════════
-- PHASE 20: Managers/members should not see finance or payroll by
-- default. Run this whole file in the Supabase SQL Editor.
--
-- The 'manager' role was seeded (phase5_rbac.sql) with finance.read,
-- finance.write, payroll.read, and payroll.write by default. Combined with
-- a code bug (fixed alongside this migration — see lib/apiAuth.ts) where
-- the API checked a hardcoded role list instead of this table, toggling
-- these off in the Permissions Matrix UI had no effect for managers. Both
-- are now fixed: this migration clears the default grant, and the owner
-- can re-grant finance/payroll access to specific managers individually
-- via /settings/permissions (role-wide) or Team → Manage Access (per person)
-- if desired.
-- ═══════════════════════════════════════════════════════════════

DELETE FROM role_permissions
WHERE role = 'manager'
  AND permission IN ('finance.read', 'finance.write', 'payroll.read', 'payroll.write');
