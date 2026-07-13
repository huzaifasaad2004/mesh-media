-- ═══════════════════════════════════════════════════════════════
-- PHASE 38: Optional contractor login — a contractor can set a
-- password from their personal token link and log in normally
-- afterward (email + password, like the client portal), instead of
-- only ever using the token link. Run in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner','admin','manager','member','viewer','client','contractor'));

-- Nullable — null means "token-link access only", set means "has a login".
-- The self-service /api/contractors/[id]/set-password route (service-role,
-- after verifying the token) is the only writer of this column.
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles ON DELETE SET NULL UNIQUE;
