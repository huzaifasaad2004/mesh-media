-- ============================================================
-- Mesh Media Agency OS — Full Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── PROFILES ───────────────────────────────────────────────
create table profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text,
  full_name   text,
  role        text not null default 'staff' check (role in ('admin', 'staff', 'viewer')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── CLIENTS ────────────────────────────────────────────────
create table clients (
  id                uuid default gen_random_uuid() primary key,
  company_name      text not null,
  industry          text,
  status            text not null default 'lead' check (status in ('lead','onboarding','active','paused','churned')),
  website           text,
  email             text,
  phone             text,
  address           text,
  notes             text,
  monthly_retainer  numeric(10,2),
  drive_folder_url  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger clients_updated_at before update on clients
  for each row execute procedure update_updated_at();

-- ─── CONTACTS ───────────────────────────────────────────────
create table contacts (
  id          uuid default gen_random_uuid() primary key,
  client_id   uuid references clients on delete cascade not null,
  full_name   text not null,
  email       text,
  phone       text,
  role        text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── CLIENT NOTES ───────────────────────────────────────────
create table client_notes (
  id          uuid default gen_random_uuid() primary key,
  client_id   uuid references clients on delete cascade not null,
  author_id   uuid references profiles on delete set null,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ─── ONBOARDING STEPS ───────────────────────────────────────
create table onboarding_steps (
  id            uuid default gen_random_uuid() primary key,
  client_id     uuid references clients on delete cascade not null,
  title         text not null,
  description   text,
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  completed_by  uuid references profiles on delete set null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Default onboarding steps on client creation
create or replace function create_default_onboarding(client_id uuid)
returns void language plpgsql as $$
begin
  insert into onboarding_steps (client_id, title, sort_order) values
    (client_id, 'Send welcome email',          1),
    (client_id, 'Schedule kick-off call',       2),
    (client_id, 'Sign contract',                3),
    (client_id, 'Collect brand assets',         4),
    (client_id, 'Set up Google Drive folder',   5),
    (client_id, 'Assign team members',          6),
    (client_id, 'Deliver first deliverable',    7);
end;
$$;

-- ─── PROJECTS ───────────────────────────────────────────────
create table projects (
  id           uuid default gen_random_uuid() primary key,
  client_id    uuid references clients on delete set null,
  name         text not null,
  description  text,
  status       text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  start_date   date,
  end_date     date,
  created_at   timestamptz not null default now()
);

-- ─── TASKS ──────────────────────────────────────────────────
create table tasks (
  id           uuid default gen_random_uuid() primary key,
  project_id   uuid references projects on delete set null,
  client_id    uuid references clients on delete set null,
  assigned_to  uuid references profiles on delete set null,
  created_by   uuid references profiles on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority     text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger tasks_updated_at before update on tasks
  for each row execute procedure update_updated_at();

-- ─── FILES ──────────────────────────────────────────────────
create table files (
  id            uuid default gen_random_uuid() primary key,
  client_id     uuid references clients on delete cascade,
  name          text not null,
  storage_path  text,
  drive_url     text,
  file_type     text,
  file_size     bigint,
  uploaded_by   uuid references profiles on delete set null,
  category      text check (category in ('contract','creative','report','invoice','other')),
  created_at    timestamptz not null default now()
);

-- ─── CONTRACTS ──────────────────────────────────────────────
create table contracts (
  id          uuid default gen_random_uuid() primary key,
  client_id   uuid references clients on delete cascade not null,
  title       text not null,
  content     text,
  status      text not null default 'draft' check (status in ('draft','sent','signed','expired','cancelled')),
  value       numeric(10,2),
  start_date  date,
  end_date    date,
  signed_at   timestamptz,
  file_id     uuid references files on delete set null,
  created_by  uuid references profiles on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger contracts_updated_at before update on contracts
  for each row execute procedure update_updated_at();

-- ─── INVOICES ───────────────────────────────────────────────
create table invoices (
  id              uuid default gen_random_uuid() primary key,
  client_id       uuid references clients on delete cascade not null,
  contract_id     uuid references contracts on delete set null,
  invoice_number  text unique not null,
  status          text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  issue_date      date not null default current_date,
  due_date        date,
  paid_date       date,
  subtotal        numeric(10,2) not null default 0,
  tax_rate        numeric(5,2) not null default 0,
  tax_amount      numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger invoices_updated_at before update on invoices
  for each row execute procedure update_updated_at();

-- Auto-generate invoice number
create sequence invoice_number_seq start 1000;

create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger invoices_number_gen before insert on invoices
  for each row execute procedure generate_invoice_number();

-- ─── INVOICE ITEMS ──────────────────────────────────────────
create table invoice_items (
  id           uuid default gen_random_uuid() primary key,
  invoice_id   uuid references invoices on delete cascade not null,
  description  text not null,
  quantity     numeric(10,2) not null default 1,
  unit_price   numeric(10,2) not null,
  amount       numeric(10,2) not null,
  sort_order   int not null default 0
);

-- Auto-update invoice totals when items change
create or replace function recalculate_invoice_total()
returns trigger language plpgsql as $$
declare
  v_subtotal numeric(10,2);
  v_tax_rate numeric(5,2);
  v_tax_amount numeric(10,2);
  v_total numeric(10,2);
  v_invoice_id uuid;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0) into v_subtotal from invoice_items where invoice_id = v_invoice_id;
  select tax_rate into v_tax_rate from invoices where id = v_invoice_id;
  v_tax_amount := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;
  update invoices set subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total, updated_at = now()
  where id = v_invoice_id;
  return coalesce(new, old);
end;
$$;

create trigger invoice_items_total after insert or update or delete on invoice_items
  for each row execute procedure recalculate_invoice_total();

-- ─── EXPENSES ───────────────────────────────────────────────
create table expenses (
  id           uuid default gen_random_uuid() primary key,
  client_id    uuid references clients on delete set null,
  category     text not null check (category in ('software','ads','freelancer','office','travel','other')),
  description  text not null,
  amount       numeric(10,2) not null,
  date         date not null default current_date,
  receipt_url  text,
  created_by   uuid references profiles on delete set null,
  created_at   timestamptz not null default now()
);

-- ─── SALARIES ───────────────────────────────────────────────
create table salaries (
  id              uuid default gen_random_uuid() primary key,
  profile_id      uuid references profiles on delete cascade not null,
  amount          numeric(10,2) not null,
  currency        text not null default 'USD',
  pay_period      text not null default 'monthly' check (pay_period in ('monthly','bi-weekly','weekly')),
  effective_from  date not null,
  effective_to    date,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ─── SALARY PAYMENTS ────────────────────────────────────────
create table salary_payments (
  id            uuid default gen_random_uuid() primary key,
  profile_id    uuid references profiles on delete cascade not null,
  salary_id     uuid references salaries on delete set null,
  amount        numeric(10,2) not null,
  payment_date  date not null,
  notes         text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table profiles         enable row level security;
alter table clients          enable row level security;
alter table contacts         enable row level security;
alter table client_notes     enable row level security;
alter table onboarding_steps enable row level security;
alter table projects         enable row level security;
alter table tasks            enable row level security;
alter table files            enable row level security;
alter table contracts        enable row level security;
alter table invoices         enable row level security;
alter table invoice_items    enable row level security;
alter table expenses         enable row level security;
alter table salaries         enable row level security;
alter table salary_payments  enable row level security;

-- All authenticated users can read everything (team members can see all company data)
create policy "Authenticated users can read all" on profiles         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on clients          for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on contacts         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on client_notes     for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on onboarding_steps for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on projects         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on tasks            for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on files            for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on contracts        for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on invoices         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on invoice_items    for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on expenses         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on salaries         for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on salary_payments  for select using (auth.role() = 'authenticated');

-- Staff and admin can insert/update/delete
create policy "Staff can write" on clients          for all using (auth.role() = 'authenticated');
create policy "Staff can write" on contacts         for all using (auth.role() = 'authenticated');
create policy "Staff can write" on client_notes     for all using (auth.role() = 'authenticated');
create policy "Staff can write" on onboarding_steps for all using (auth.role() = 'authenticated');
create policy "Staff can write" on projects         for all using (auth.role() = 'authenticated');
create policy "Staff can write" on tasks            for all using (auth.role() = 'authenticated');
create policy "Staff can write" on files            for all using (auth.role() = 'authenticated');
create policy "Staff can write" on contracts        for all using (auth.role() = 'authenticated');
create policy "Staff can write" on invoices         for all using (auth.role() = 'authenticated');
create policy "Staff can write" on invoice_items    for all using (auth.role() = 'authenticated');
create policy "Staff can write" on expenses         for all using (auth.role() = 'authenticated');
create policy "Staff can write" on salaries         for all using (auth.role() = 'authenticated');
create policy "Staff can write" on salary_payments  for all using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ─── SAMPLE DATA (optional, comment out if not needed) ──────
-- insert into clients (company_name, industry, status, email, monthly_retainer) values
--   ('TechFlow Inc', 'SaaS', 'active', 'contact@techflow.com', 5000),
--   ('BlueSky Retail', 'E-commerce', 'onboarding', 'hello@bluesky.com', 3500),
--   ('Summit Finance', 'Finance', 'lead', 'info@summit.com', null);
