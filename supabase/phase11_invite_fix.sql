-- ═══════════════════════════════════════════════════════════════
-- PHASE 11: Fix team invite / password setup flow
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- Tracks whether an invited team member has chosen their password yet.
-- Defaults to true so existing users (who already have passwords) are unaffected.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT true;

SELECT 'Phase 11 invite-fix migration complete' AS status;
