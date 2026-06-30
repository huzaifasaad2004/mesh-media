-- Phase 2 Migration: Quotations, client improvements, recurring expenses
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/avodyziayfkvmuyoyuqs/sql

-- 1. Clients: add contact_person and website
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website text;

-- 2. Invoices: add subject field
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subject text;

-- 3. Expenses: add recurring flag
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring boolean not null default false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_notes text;

-- 4. Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id            uuid default gen_random_uuid() primary key,
  client_id     uuid references clients on delete cascade not null,
  quote_number  text unique not null,
  status        text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  issue_date    date not null default current_date,
  expiry_date   date,
  subject       text,
  subtotal      numeric(10,2) not null default 0,
  tax_rate      numeric(5,2) not null default 0,
  tax_amount    numeric(10,2) not null default 0,
  total         numeric(10,2) not null default 0,
  notes         text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 5. Create quotation_items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id            uuid default gen_random_uuid() primary key,
  quotation_id  uuid references quotations on delete cascade not null,
  description   text not null,
  quantity      numeric(10,2) not null default 1,
  unit_price    numeric(10,2) not null,
  amount        numeric(10,2) not null,
  sort_order    int not null default 0
);

-- 6. Quote number sequence
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1000;

-- 7. Auto-generate quote number trigger
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.quote_number IS NULL OR new.quote_number = '' THEN
    new.quote_number := 'MM-QT-' || lpad(nextval('quote_number_seq')::text, 6, '0');
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER quotations_number_gen BEFORE INSERT ON quotations
  FOR EACH ROW EXECUTE PROCEDURE generate_quote_number();

-- 8. Auto-update updated_at
CREATE TRIGGER quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- 9. RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read quotations" ON quotations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write quotations" ON quotations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read quotation_items" ON quotation_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write quotation_items" ON quotation_items FOR ALL USING (auth.role() = 'authenticated');

-- Done!
SELECT 'Migration complete' as status;
