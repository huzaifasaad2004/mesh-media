-- PHASE 52: Explicitly remove anonymous execution from chat RLS helpers.
-- Supabase may retain role-specific function grants after PUBLIC is revoked.

REVOKE EXECUTE ON FUNCTION chat_can_access_channel(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION chat_can_access_realtime_topic(text) FROM anon;

GRANT EXECUTE ON FUNCTION chat_can_access_channel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION chat_can_access_realtime_topic(text) TO authenticated;

SELECT 'Phase 52 chat helper grants hardened' AS status;
