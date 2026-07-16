-- ═══════════════════════════════════════════════════════════════
-- PHASE 49: Fix "infinite recursion detected in policy for relation
-- meeting_attendees" — the meetings/meeting_attendees read policies
-- each queried the other table directly, so evaluating one triggered
-- the other's RLS check, which triggered the first again. Every
-- other cross-table read policy in this schema (my_client_ids(),
-- my_assigned_client_ids(), etc.) avoids exactly this by wrapping the
-- lookup in a SECURITY DEFINER function, which runs with the
-- function owner's privileges and so doesn't re-trigger RLS on the
-- table it queries. Applying the same pattern here.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION my_meeting_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT meeting_id FROM meeting_attendees WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_organized_meeting_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM meetings WHERE organizer_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_client_meeting_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM meetings WHERE client_id IN (SELECT my_client_ids())
$$;

DROP POLICY IF EXISTS "meetings read scoped" ON meetings;
CREATE POLICY "meetings read scoped" ON meetings FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager')
    OR id IN (SELECT my_meeting_ids())
    OR client_id IN (SELECT my_client_ids())
  );

DROP POLICY IF EXISTS "meeting attendees read scoped" ON meeting_attendees;
CREATE POLICY "meeting attendees read scoped" ON meeting_attendees FOR SELECT
  USING (
    my_role() IN ('owner','admin','manager')
    OR user_id = auth.uid()
    OR meeting_id IN (SELECT my_organized_meeting_ids())
    OR meeting_id IN (SELECT my_client_meeting_ids())
  );

SELECT 'Phase 49 meeting-rls-recursion-fix migration complete' AS status;
