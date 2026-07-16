-- ═══════════════════════════════════════════════════════════════
-- PHASE 44: Knowledge Base and Media Coverage become manager+ only —
-- 'member' should not see either module at all (explicit request,
-- reversing the earlier default-on grants from phase41/phase42).
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

DELETE FROM role_permissions
WHERE role = 'member' AND permission IN ('kb.read', 'media.read', 'media.write');

-- kb_articles' read policy already gates the published-articles branch on
-- has_permission(auth.uid(), 'kb.read') — revoking the grant above is
-- sufficient there. media_placements' read policy explicitly allowed
-- 'member' for their assigned clients regardless of permission grants, so
-- that branch has to be removed from the policy itself, not just the
-- permission row.
DROP POLICY IF EXISTS "media placements read scoped" ON media_placements;
CREATE POLICY "media placements read scoped" ON media_placements FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager','viewer')
    OR client_id IN (SELECT my_client_ids())
  );

SELECT 'Phase 44 kb/media restriction migration complete' AS status;
