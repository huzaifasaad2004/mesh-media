-- Fix: create update_updated_at() if it doesn't exist (required by quotations trigger)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on quotations
DROP TRIGGER IF EXISTS quotations_updated_at ON quotations;
CREATE TRIGGER quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Add terms columns if not yet added (phase3)
ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms text;

SELECT 'Phase 4 fix complete' AS status;
