-- ═══════════════════════════════════════════════════════════════
-- PHASE 24: Client onboarding workflows — templates → runs → steps.
-- Replaces the unused flat `onboarding_steps` table (never populated,
-- its create_default_onboarding() function was dead code).
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS onboarding_steps;

CREATE TABLE onboarding_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES profiles ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_template_steps (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES onboarding_templates ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE onboarding_runs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  template_id   uuid REFERENCES onboarding_templates ON DELETE SET NULL,
  template_name text NOT NULL, -- snapshot, survives template edits/deletion
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_by    uuid REFERENCES profiles ON DELETE SET NULL
);
-- one active run per client at a time
CREATE UNIQUE INDEX onboarding_runs_one_active ON onboarding_runs (client_id) WHERE status = 'active';

CREATE TABLE onboarding_run_steps (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id       uuid REFERENCES onboarding_runs ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  description  text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles ON DELETE SET NULL,
  sort_order   int NOT NULL DEFAULT 0
);

ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_run_steps ENABLE ROW LEVEL SECURITY;

-- Same read/write split as the table this replaces (phase5_rbac.sql):
-- any staff can read; can_write_ops() can write. Template *management* is
-- additionally gated to managers+ at the API layer (see route handlers).
CREATE POLICY "staff read onboarding templates" ON onboarding_templates FOR SELECT USING (is_staff());
CREATE POLICY "ops write onboarding templates" ON onboarding_templates FOR ALL USING (can_write_ops());
CREATE POLICY "staff read onboarding template steps" ON onboarding_template_steps FOR SELECT USING (is_staff());
CREATE POLICY "ops write onboarding template steps" ON onboarding_template_steps FOR ALL USING (can_write_ops());
CREATE POLICY "staff read onboarding runs" ON onboarding_runs FOR SELECT USING (is_staff());
CREATE POLICY "ops write onboarding runs" ON onboarding_runs FOR ALL USING (can_write_ops());
CREATE POLICY "staff read onboarding run steps" ON onboarding_run_steps FOR SELECT USING (is_staff());
CREATE POLICY "ops write onboarding run steps" ON onboarding_run_steps FOR ALL USING (can_write_ops());

CREATE INDEX IF NOT EXISTS onboarding_template_steps_template_idx ON onboarding_template_steps (template_id, sort_order);
CREATE INDEX IF NOT EXISTS onboarding_runs_client_idx ON onboarding_runs (client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_run_steps_run_idx ON onboarding_run_steps (run_id, sort_order);
