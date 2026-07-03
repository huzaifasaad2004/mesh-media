-- ═══════════════════════════════════════════════════════════════
-- PHASE 9 (Build-plan Phase 4 extras): Approvals workflow
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS approvals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester   uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  type        text NOT NULL CHECK (type IN ('time_off','expense','other')),
  title       text NOT NULL,
  details     text,
  amount      numeric(10,2),           -- for expense requests
  start_date  date,                    -- for time-off
  end_date    date,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by  uuid REFERENCES profiles ON DELETE SET NULL,
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS approvals_status ON approvals (status, created_at DESC);

-- Requesters see their own; managers/admins see all
CREATE POLICY "read approvals" ON approvals FOR SELECT
  USING (requester = auth.uid() OR my_role() IN ('owner','admin','manager'));
CREATE POLICY "create own approvals" ON approvals FOR INSERT
  WITH CHECK (requester = auth.uid());
CREATE POLICY "managers decide approvals" ON approvals FOR UPDATE
  USING (my_role() IN ('owner','admin','manager'));

SELECT 'Phase 9 approvals migration complete' AS status;
