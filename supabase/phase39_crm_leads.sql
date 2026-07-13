-- ═══════════════════════════════════════════════════════════════
-- PHASE 39: CRM / Leads pipeline — track prospects BEFORE they
-- become clients. Stages are ordered kanban columns; a lead is
-- open / won / lost, and winning it converts into a real clients
-- row. Run in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('leads.read',  'View the CRM leads pipeline'),
  ('leads.write', 'Add, edit, move, and convert leads')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','leads.read'),   ('owner','leads.write'),
  ('admin','leads.read'),   ('admin','leads.write'),
  ('manager','leads.read'), ('manager','leads.write')
ON CONFLICT DO NOTHING;

-- ─── 1. Pipeline stages (ordered kanban columns) ────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline stages read" ON pipeline_stages FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'leads.read') OR has_permission(auth.uid(), 'leads.write'));
CREATE POLICY "pipeline stages write" ON pipeline_stages FOR ALL
  USING (has_permission(auth.uid(), 'leads.write'));

INSERT INTO pipeline_stages (name, position) VALUES
  ('New',           0),
  ('Contacted',     1),
  ('Qualified',     2),
  ('Proposal Sent', 3),
  ('Negotiation',   4)
ON CONFLICT DO NOTHING;

-- ─── 2. Leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name        text NOT NULL,
  contact_name        text,
  email               text,
  phone               text,
  website             text,
  source              text NOT NULL DEFAULT 'other' CHECK (source IN
                        ('referral','instagram','website','cold_outreach','event','existing_network','other')),
  stage_id            uuid REFERENCES pipeline_stages ON DELETE SET NULL,
  estimated_value     numeric(12,2),
  currency            text NOT NULL DEFAULT 'AED',
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  lost_reason         text,
  next_follow_up      date,
  notes               text,
  assigned_to         uuid REFERENCES profiles ON DELETE SET NULL,
  converted_client_id uuid REFERENCES clients ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE INDEX IF NOT EXISTS leads_stage_idx  ON leads (stage_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status, next_follow_up);

CREATE POLICY "leads read" ON leads FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'leads.read') OR has_permission(auth.uid(), 'leads.write'));
CREATE POLICY "leads write" ON leads FOR ALL
  USING (has_permission(auth.uid(), 'leads.write'));

-- ─── 3. Lead activity timeline (calls, notes, meetings, stage moves) ──
CREATE TABLE IF NOT EXISTS lead_activities (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id    uuid REFERENCES leads ON DELETE CASCADE NOT NULL,
  type       text NOT NULL DEFAULT 'note' CHECK (type IN
               ('note','call','meeting','email','whatsapp','stage_change','status_change')),
  note       text,
  created_by uuid REFERENCES profiles ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities (lead_id, created_at DESC);

CREATE POLICY "lead activities read" ON lead_activities FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'leads.read') OR has_permission(auth.uid(), 'leads.write'));
CREATE POLICY "lead activities write" ON lead_activities FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'leads.write'));
