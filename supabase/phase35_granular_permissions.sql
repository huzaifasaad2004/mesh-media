-- ═══════════════════════════════════════════════════════════════
-- PHASE 35: Granular permissions — split a few role-hardcoded
-- actions out into their own togglable permission keys, editable
-- per-role (Settings → Permissions) and per-person (Team → Manage
-- Access), instead of being fixed to "manager and above" in code.
--
-- Every default below exactly mirrors the role-array checks these
-- keys replace, so this changes nothing on its own — it only makes
-- the behavior editable going forward. Run in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (key, description) VALUES
  ('tasks.manage',     'Create, assign, and delete tasks (not just update your own)'),
  ('projects.write',   'Create and edit projects'),
  ('projects.delete',  'Delete projects'),
  ('invoices.send',    'Email invoices and quotations to clients'),
  ('documents.write',  'Upload documents and place e-signature fields'),
  ('content.approve',  'Review submitted content and forward or return it')
ON CONFLICT (key) DO NOTHING;

-- Defaults mirror the exact role arrays each of these keys replaces:
--   tasks.manage, content.approve   -> previously MANAGERS      (owner, admin, manager)
--   projects.write, documents.write -> previously OPS_WRITE     (owner, admin, manager, member)
--   projects.delete                 -> previously MANAGERS
--   invoices.send                   -> previously finance.write (owner, admin, manager)
INSERT INTO role_permissions (role, permission) VALUES
  ('owner','tasks.manage'),   ('admin','tasks.manage'),   ('manager','tasks.manage'),
  ('owner','projects.write'), ('admin','projects.write'), ('manager','projects.write'), ('member','projects.write'),
  ('owner','projects.delete'),('admin','projects.delete'),('manager','projects.delete'),
  ('owner','invoices.send'),  ('admin','invoices.send'),  ('manager','invoices.send'),
  ('owner','documents.write'),('admin','documents.write'),('manager','documents.write'),('member','documents.write'),
  ('owner','content.approve'),('admin','content.approve'),('manager','content.approve')
ON CONFLICT DO NOTHING;
