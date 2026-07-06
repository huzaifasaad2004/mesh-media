-- ═══════════════════════════════════════════════════════════════════
-- Phase 17 — SECURITY HARDENING (docs/SECURITY_AUDIT.md, 2026-07-05)
-- Fix #1: block self-service role escalation on profiles
-- Fix #6: atomic document numbering (no duplicate invoice numbers)
-- Plus: lock down the exec_sql helper RPC if present
-- ═══════════════════════════════════════════════════════════════════

-- ── Fix #1 ─────────────────────────────────────────────────────────
-- The old self-update policy had no WITH CHECK and no column guard, so
-- any logged-in user could PATCH their own row to role='owner'.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Defense-in-depth: end users can never change role. auth.uid() IS NULL
-- means a server-side service-role write (those are role-checked in the
-- API layer) — the app's own admin flows keep working.
CREATE OR REPLACE FUNCTION guard_profile_privileged_cols()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_profile_role ON profiles;
CREATE TRIGGER guard_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged_cols();

-- ── Fix #6 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_counters (
  kind text NOT NULL,
  year int NOT NULL,
  n    int NOT NULL,
  PRIMARY KEY (kind, year)
);
-- RLS on, no policies: only service-role / SECURITY DEFINER paths touch it.
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION next_doc_number(p_kind text, p_prefix text)
RETURNS text AS $$
DECLARE
  y int := extract(year from now());
  v int;
BEGIN
  INSERT INTO doc_counters(kind, year, n) VALUES (p_kind, y, 101)
    ON CONFLICT (kind, year) DO UPDATE SET n = doc_counters.n + 1
    RETURNING n INTO v;
  RETURN p_prefix || y || '-' || lpad(v::text, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Only server code mints numbers — not browser JWTs.
REVOKE EXECUTE ON FUNCTION next_doc_number(text, text) FROM PUBLIC, anon, authenticated;

-- Seed counters from existing documents so numbering continues, never repeats.
INSERT INTO doc_counters(kind, year, n)
SELECT 'invoice', (t.m)[1]::int, max((t.m)[2]::int)
FROM (SELECT regexp_match(invoice_number, '(\d{4})-(\d+)$') AS m FROM invoices) t
WHERE t.m IS NOT NULL
GROUP BY (t.m)[1]::int
ON CONFLICT (kind, year) DO UPDATE SET n = GREATEST(doc_counters.n, EXCLUDED.n);

INSERT INTO doc_counters(kind, year, n)
SELECT 'quote', (t.m)[1]::int, max((t.m)[2]::int)
FROM (SELECT regexp_match(quote_number, '(\d{4})-(\d+)$') AS m FROM quotations) t
WHERE t.m IS NOT NULL
GROUP BY (t.m)[1]::int
ON CONFLICT (kind, year) DO UPDATE SET n = GREATEST(doc_counters.n, EXCLUDED.n);

-- Unique backstops (skipped with a NOTICE if historical duplicates exist).
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_key ON invoices (invoice_number);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'invoice_number has historical duplicates - unique index skipped';
  END;
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS quotations_quote_number_key ON quotations (quote_number);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'quote_number has historical duplicates - unique index skipped';
  END;
END $$;

-- ── exec_sql lockdown ──────────────────────────────────────────────
-- An arbitrary-SQL RPC must never be callable with the anon or user JWT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'exec_sql' AND ns.nspname = 'public'
  ) THEN
    BEGIN
      REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END IF;
END $$;
