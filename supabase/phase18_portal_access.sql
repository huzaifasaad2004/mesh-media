-- ═══════════════════════════════════════════════════════════════
-- PHASE 18: Client portal access manager — per-client on/off switch
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN clients.portal_enabled IS
  'When false, this client''s portal users are blocked from /portal even though their login still works — used to suspend access without deleting the invite.';
