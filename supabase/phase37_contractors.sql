-- ═══════════════════════════════════════════════════════════════
-- PHASE 37: Contractors — project-based freelancers paid one-off
-- amounts, not salaried employees. Most have no portal account, so
-- they get a personal token link (same pattern as e-signature
-- recipients) to see their payment history, download receipts, and
-- upload their own project files. Run in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('contractors.read',  'View contractors and their payment history'),
  ('contractors.write', 'Add contractors and record payments to them')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','contractors.read'), ('owner','contractors.write'),
  ('admin','contractors.read'), ('admin','contractors.write'),
  ('manager','contractors.read'), ('manager','contractors.write')
ON CONFLICT DO NOTHING;

-- ─── 1. Contractors ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contractors (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  email         text,
  phone         text,
  bank_details  text, -- freeform: IBAN/account/bank name, not structured — varies too much across contractors
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes         text,
  access_token  uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, -- personal link, no login required
  created_by    uuid REFERENCES profiles ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER contractors_updated_at BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE POLICY "contractors read" ON contractors FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'contractors.read') OR has_permission(auth.uid(), 'contractors.write'));
CREATE POLICY "contractors write" ON contractors FOR ALL
  USING (has_permission(auth.uid(), 'contractors.write'));

-- ─── 2. One-off, per-project payments ──────────────────────────
CREATE TABLE IF NOT EXISTS contractor_payments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id  uuid REFERENCES contractors ON DELETE CASCADE NOT NULL,
  project_id     uuid REFERENCES projects ON DELETE SET NULL, -- optional — not every payment is tied to a project
  amount         numeric(10,2) NOT NULL,
  currency       text NOT NULL DEFAULT 'AED',
  description    text,
  payment_date   date NOT NULL,
  created_by     uuid REFERENCES profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS contractor_payments_contractor_idx ON contractor_payments (contractor_id, payment_date DESC);

CREATE POLICY "contractor payments read" ON contractor_payments FOR SELECT
  USING (is_admin() OR has_permission(auth.uid(), 'contractors.read') OR has_permission(auth.uid(), 'contractors.write'));
CREATE POLICY "contractor payments write" ON contractor_payments FOR ALL
  USING (has_permission(auth.uid(), 'contractors.write'));

-- ─── 3. Contractors can upload into the existing files module ─────
ALTER TABLE files ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS files_contractor_idx ON files (contractor_id);
