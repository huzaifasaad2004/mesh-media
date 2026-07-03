-- ═══════════════════════════════════════════════════════════════
-- PHASE 12: Per-person permission overrides
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- role_permissions (from Phase 5) defines the DEFAULT access for a role.
-- user_permissions lets an admin override that default for one specific
-- person — grant something their role wouldn't normally have, or revoke
-- something it would. No row here = "use the role default".
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  permission text REFERENCES permissions ON DELETE CASCADE NOT NULL,
  granted    boolean NOT NULL,
  updated_by uuid REFERENCES profiles ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own effective overrides (needed for UI gating);
-- only admins can read/write anyone else's.
CREATE POLICY "read own or admin user_permissions" ON user_permissions FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "admin write user_permissions" ON user_permissions FOR ALL
  USING (is_admin());

SELECT 'Phase 12 user_permissions migration complete' AS status;
