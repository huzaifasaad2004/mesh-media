-- Workflow Automation Builder
-- Prepared only. Apply to Supabase together with the application deployment.

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  trigger_type text not null check (trigger_type in (
    'client_created', 'lead_won', 'quotation_accepted', 'invoice_paid',
    'task_completed', 'project_completed', 'manual'
  )),
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  is_active boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  run_count integer not null default 0 check (run_count >= 0),
  last_error text
);

create table if not exists automation_actions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references automation_rules(id) on delete cascade,
  action_type text not null check (action_type in (
    'create_task', 'send_notification', 'start_onboarding',
    'create_project', 'update_client_status'
  )),
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references automation_rules(id) on delete set null,
  rule_name text not null,
  trigger_type text not null,
  event_key text,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partially_failed', 'failed', 'skipped')),
  context jsonb not null default '{}'::jsonb,
  action_results jsonb not null default '[]'::jsonb check (jsonb_typeof(action_results) = 'array'),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  initiated_by uuid references profiles(id) on delete set null
);

create unique index if not exists automation_runs_event_once
  on automation_runs(rule_id, event_key) where event_key is not null;
create index if not exists automation_actions_rule_order
  on automation_actions(rule_id, sort_order);
create index if not exists automation_rules_active_trigger
  on automation_rules(trigger_type) where is_active;
create index if not exists automation_runs_recent
  on automation_runs(started_at desc);

alter table automation_rules enable row level security;
alter table automation_actions enable row level security;
alter table automation_runs enable row level security;

create policy "managers read automation rules" on automation_rules for select
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers create automation rules" on automation_rules for insert
  to authenticated with check (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers update automation rules" on automation_rules for update
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false))
  with check (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers delete automation rules" on automation_rules for delete
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false));

create policy "managers read automation actions" on automation_actions for select
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers create automation actions" on automation_actions for insert
  to authenticated with check (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers update automation actions" on automation_actions for update
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false))
  with check (coalesce((select my_role()) in ('owner','admin','manager'), false));
create policy "managers delete automation actions" on automation_actions for delete
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false));

create policy "managers read automation runs" on automation_runs for select
  to authenticated using (coalesce((select my_role()) in ('owner','admin','manager'), false));

-- Explicit Data API access (new Supabase projects no longer auto-expose tables).
grant select, insert, update, delete on automation_rules to authenticated;
grant select, insert, update, delete on automation_actions to authenticated;
grant select on automation_runs to authenticated;
grant select, insert, update, delete on automation_rules, automation_actions, automation_runs to service_role;
revoke all on automation_rules, automation_actions, automation_runs from anon;

drop trigger if exists automation_rules_updated_at on automation_rules;
create trigger automation_rules_updated_at before update on automation_rules
  for each row execute procedure update_updated_at();

comment on table automation_rules is 'Admin-defined when-this-happens workflow rules.';
comment on table automation_runs is 'Immutable execution history for workflow auditing and troubleshooting.';
