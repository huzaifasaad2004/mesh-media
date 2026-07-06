-- ═══════════════════════════════════════════════════════════════
-- PHASE 19: Audit log — who did what, when
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  actor_email  text,
  action       text NOT NULL,      -- e.g. 'create', 'update', 'delete', 'send', 'convert', 'pay'
  entity_type  text NOT NULL,      -- e.g. 'client', 'invoice', 'quotation', 'task'
  entity_id    text,
  entity_label text,               -- human-readable label captured at write time (survives row deletion)
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can browse the audit trail. Writes happen exclusively via
-- the service-role client from API routes, so no INSERT policy is needed —
-- RLS blocks direct client writes by default (no matching policy = deny).
CREATE POLICY "admins read activity log" ON activity_log
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON activity_log (entity_type, entity_id);
