-- ═══════════════════════════════════════════════════════════════
-- PHASE 23: Monthly branded Impact Report PDF per client.
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS client_reports (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  period        text NOT NULL, -- 'YYYY-MM'
  pdf_url       text NOT NULL,
  storage_path  text NOT NULL,
  stats         jsonb NOT NULL,
  emailed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period)
);
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;

-- Reads only — all writes go through the service-role cron/manual-trigger
-- route, same convention as every other table in this schema.
CREATE POLICY "staff read client reports" ON client_reports FOR SELECT USING (is_staff());
CREATE POLICY "client read own reports" ON client_reports FOR SELECT
  USING (client_id IN (SELECT my_client_ids()));

CREATE INDEX IF NOT EXISTS client_reports_client_idx ON client_reports (client_id, period DESC);

-- Storage bucket for generated report PDFs — public like invoices/quotations
-- (writes are service-role only via the report generation route).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-reports', 'client-reports', true)
ON CONFLICT (id) DO NOTHING;
