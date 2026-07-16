-- ═══════════════════════════════════════════════════════════════
-- PHASE 48: Google OAuth token storage for the Meetings module's
-- Calendar integration — replaces the earlier service-account/
-- domain-wide-delegation design with a simple "Connect Google
-- Calendar" OAuth flow (reusing the same GOOGLE_CLIENT_ID/SECRET
-- already set up for Celine, per Huzaifa's call — see BUILD_PLAN).
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- Single-row table (one Google account connected at a time, matching
-- Celine's own oauth_tokens design). No RLS policies at all — this is
-- read/written exclusively by service-role from server-side API routes,
-- never through a user session, so "enabled with zero policies" means
-- nobody can touch it except service-role, which bypasses RLS entirely.
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider    text NOT NULL DEFAULT 'google',
  ciphertext  text NOT NULL, -- AES-256-GCM encrypted JSON tokens (lib/crypto.ts), key = TOKEN_ENCRYPTION_KEY
  account     text,          -- the Google email address that was connected, for display in Settings
  connected_by uuid REFERENCES profiles ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS google_oauth_tokens_provider_idx ON google_oauth_tokens (provider);

SELECT 'Phase 48 google-oauth migration complete' AS status;
