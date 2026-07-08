-- ═══════════════════════════════════════════════════════════════
-- PHASE 30: Self-service profile — name + avatar upload, for both
-- staff and client-portal users (BUILD_PLAN.md §D #14). Run this
-- whole file in the Supabase SQL Editor.
--
-- profiles.avatar_url already exists (schema.sql) and already covers
-- BOTH staff and client-portal users — every authenticated person,
-- staff or client, has exactly one profiles row. No new column or
-- clients-side table needed.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

SELECT 'Phase 30 profile-pictures migration complete' AS status;
