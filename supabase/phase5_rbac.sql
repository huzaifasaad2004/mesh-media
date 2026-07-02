-- ═══════════════════════════════════════════════════════════════
-- PHASE 5 (Build-plan Phase 1): Roles, RBAC, RLS, Notifications
-- Run this whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Extend roles ────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'member' WHERE role = 'staff';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner','admin','manager','member','viewer','client'));

-- New signups default to 'member'; invited users carry their role in metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 2. Client-portal user mapping ─────────────────────────────
CREATE TABLE IF NOT EXISTS client_contacts (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  client_id  uuid REFERENCES clients ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

-- ─── 3. Granular permissions (editable without code changes) ───
CREATE TABLE IF NOT EXISTS permissions (
  key         text PRIMARY KEY,
  description text
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role       text NOT NULL,
  permission text REFERENCES permissions ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (role, permission)
);
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, description) VALUES
  ('clients.read',    'View all clients'),
  ('clients.write',   'Create/edit clients'),
  ('tasks.write',     'Create/edit tasks'),
  ('finance.read',    'View invoices, quotations, expenses'),
  ('finance.write',   'Create/edit finance records'),
  ('payroll.read',    'View salaries & payslips'),
  ('payroll.write',   'Manage salaries'),
  ('team.manage',     'Invite/manage team members'),
  ('settings.manage', 'Change org settings')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','clients.read'),('owner','clients.write'),('owner','tasks.write'),
  ('owner','finance.read'),('owner','finance.write'),('owner','payroll.read'),
  ('owner','payroll.write'),('owner','team.manage'),('owner','settings.manage'),
  ('admin','clients.read'),('admin','clients.write'),('admin','tasks.write'),
  ('admin','finance.read'),('admin','finance.write'),('admin','payroll.read'),
  ('admin','payroll.write'),('admin','team.manage'),('admin','settings.manage'),
  ('manager','clients.read'),('manager','clients.write'),('manager','tasks.write'),
  ('manager','finance.read'),('manager','finance.write'),
  ('member','clients.read'),('member','tasks.write'),
  ('viewer','clients.read'),('viewer','finance.read')
ON CONFLICT DO NOTHING;

-- ─── 4. Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title      text NOT NULL,
  body       text,
  href       text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- Realtime for the bell
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. RLS helper functions (SECURITY DEFINER avoids recursion) ─
CREATE OR REPLACE FUNCTION my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM client_contacts WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(my_role() IN ('owner','admin','manager','member','viewer'), false)
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(my_role() IN ('owner','admin'), false)
$$;

CREATE OR REPLACE FUNCTION can_write_ops()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(my_role() IN ('owner','admin','manager','member'), false)
$$;

CREATE OR REPLACE FUNCTION can_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(my_role() IN ('owner','admin','manager','viewer'), false)
$$;

-- ─── 6. Replace blanket policies with role-aware ones ──────────

-- profiles: staff read all (needed for assignee lists); own row always
DROP POLICY IF EXISTS "Authenticated users can read all" ON profiles;
CREATE POLICY "staff read profiles" ON profiles FOR SELECT
  USING (is_staff() OR id = auth.uid());

-- clients: staff read; ops write; clients read own company row
DROP POLICY IF EXISTS "Authenticated users can read all" ON clients;
DROP POLICY IF EXISTS "Staff can write" ON clients;
CREATE POLICY "staff read clients"  ON clients FOR SELECT USING (is_staff() OR id IN (SELECT my_client_ids()));
CREATE POLICY "ops write clients"   ON clients FOR ALL    USING (can_write_ops());

-- contacts / client_notes / onboarding_steps: staff only
DROP POLICY IF EXISTS "Authenticated users can read all" ON contacts;
DROP POLICY IF EXISTS "Staff can write" ON contacts;
CREATE POLICY "staff read contacts" ON contacts FOR SELECT USING (is_staff());
CREATE POLICY "ops write contacts"  ON contacts FOR ALL    USING (can_write_ops());

DROP POLICY IF EXISTS "Authenticated users can read all" ON client_notes;
DROP POLICY IF EXISTS "Staff can write" ON client_notes;
CREATE POLICY "staff read notes" ON client_notes FOR SELECT USING (is_staff());
CREATE POLICY "ops write notes"  ON client_notes FOR ALL    USING (can_write_ops());

DROP POLICY IF EXISTS "Authenticated users can read all" ON onboarding_steps;
DROP POLICY IF EXISTS "Staff can write" ON onboarding_steps;
CREATE POLICY "staff read onboarding" ON onboarding_steps FOR SELECT USING (is_staff());
CREATE POLICY "ops write onboarding"  ON onboarding_steps FOR ALL    USING (can_write_ops());

-- projects: staff all; clients see their own projects
DROP POLICY IF EXISTS "Authenticated users can read all" ON projects;
DROP POLICY IF EXISTS "Staff can write" ON projects;
CREATE POLICY "staff read projects" ON projects FOR SELECT
  USING (is_staff() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "ops write projects"  ON projects FOR ALL USING (can_write_ops());

-- tasks: staff only
DROP POLICY IF EXISTS "Authenticated users can read all" ON tasks;
DROP POLICY IF EXISTS "Staff can write" ON tasks;
CREATE POLICY "staff read tasks" ON tasks FOR SELECT USING (is_staff());
CREATE POLICY "ops write tasks"  ON tasks FOR ALL    USING (can_write_ops());

-- files: staff all; clients see files on their client
DROP POLICY IF EXISTS "Authenticated users can read all" ON files;
DROP POLICY IF EXISTS "Staff can write" ON files;
CREATE POLICY "staff read files" ON files FOR SELECT
  USING (is_staff() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "ops write files"  ON files FOR ALL USING (can_write_ops());

-- contracts: staff all; clients see their own
DROP POLICY IF EXISTS "Authenticated users can read all" ON contracts;
DROP POLICY IF EXISTS "Staff can write" ON contracts;
CREATE POLICY "staff read contracts" ON contracts FOR SELECT
  USING (is_staff() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "ops write contracts"  ON contracts FOR ALL USING (can_write_ops());

-- invoices: finance roles read; clients see their own; finance roles write
DROP POLICY IF EXISTS "Authenticated users can read all" ON invoices;
DROP POLICY IF EXISTS "Staff can write" ON invoices;
CREATE POLICY "finance read invoices" ON invoices FOR SELECT
  USING (can_finance() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "finance write invoices" ON invoices FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

DROP POLICY IF EXISTS "Authenticated users can read all" ON invoice_items;
DROP POLICY IF EXISTS "Staff can write" ON invoice_items;
CREATE POLICY "finance read invoice_items" ON invoice_items FOR SELECT
  USING (can_finance() OR invoice_id IN (SELECT id FROM invoices WHERE client_id IN (SELECT my_client_ids())));
CREATE POLICY "finance write invoice_items" ON invoice_items FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

-- quotations: same pattern
DROP POLICY IF EXISTS "Auth read quotations" ON quotations;
DROP POLICY IF EXISTS "Auth write quotations" ON quotations;
CREATE POLICY "finance read quotations" ON quotations FOR SELECT
  USING (can_finance() OR client_id IN (SELECT my_client_ids()));
CREATE POLICY "finance write quotations" ON quotations FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

DROP POLICY IF EXISTS "Auth read quotation_items" ON quotation_items;
DROP POLICY IF EXISTS "Auth write quotation_items" ON quotation_items;
CREATE POLICY "finance read quotation_items" ON quotation_items FOR SELECT
  USING (can_finance() OR quotation_id IN (SELECT id FROM quotations WHERE client_id IN (SELECT my_client_ids())));
CREATE POLICY "finance write quotation_items" ON quotation_items FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

-- expenses: finance roles only
DROP POLICY IF EXISTS "Authenticated users can read all" ON expenses;
DROP POLICY IF EXISTS "Staff can write" ON expenses;
CREATE POLICY "finance read expenses"  ON expenses FOR SELECT USING (can_finance());
CREATE POLICY "finance write expenses" ON expenses FOR ALL
  USING (my_role() IN ('owner','admin','manager'));

-- salaries: admins all; members their own payslip
DROP POLICY IF EXISTS "Authenticated users can read all" ON salaries;
DROP POLICY IF EXISTS "Staff can write" ON salaries;
CREATE POLICY "payroll read salaries" ON salaries FOR SELECT
  USING (is_admin() OR profile_id = auth.uid());
CREATE POLICY "payroll write salaries" ON salaries FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read all" ON salary_payments;
DROP POLICY IF EXISTS "Staff can write" ON salary_payments;
CREATE POLICY "payroll read payments" ON salary_payments FOR SELECT
  USING (is_admin() OR salary_id IN (SELECT id FROM salaries WHERE profile_id = auth.uid()));
CREATE POLICY "payroll write payments" ON salary_payments FOR ALL USING (is_admin());

-- client_contacts: admins manage; users see their own mapping
CREATE POLICY "own client mapping" ON client_contacts FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "admin write client mapping" ON client_contacts FOR ALL USING (is_admin());

-- permissions tables: staff can read (drives UI), admins edit
CREATE POLICY "staff read permissions"       ON permissions      FOR SELECT USING (is_staff());
CREATE POLICY "staff read role_permissions"  ON role_permissions FOR SELECT USING (is_staff());
CREATE POLICY "admin write permissions"      ON permissions      FOR ALL USING (is_admin());
CREATE POLICY "admin write role_permissions" ON role_permissions FOR ALL USING (is_admin());

-- notifications: own rows only
CREATE POLICY "own notifications read"   ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ─── 7. Make YOU the owner ──────────────────────────────────────
UPDATE profiles SET role = 'owner' WHERE email = 'huzaifasaad2004@gmail.com';
UPDATE profiles SET role = 'owner' WHERE email = 'hello@m3m.ae';

SELECT 'Phase 5 RBAC migration complete' AS status;
