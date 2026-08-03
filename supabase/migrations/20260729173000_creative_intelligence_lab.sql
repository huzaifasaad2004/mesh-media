-- Mesh Creative Lab
insert into permissions (key, description) values
  ('creative.read', 'View creative intelligence, performance patterns, and experiments'),
  ('creative.write', 'Tag creatives and manage creative experiments')
on conflict (key) do update set description = excluded.description;

insert into role_permissions (role, permission) values
  ('owner', 'creative.read'), ('admin', 'creative.read'), ('manager', 'creative.read'),
  ('member', 'creative.read'), ('viewer', 'creative.read'),
  ('owner', 'creative.write'), ('admin', 'creative.write'), ('manager', 'creative.write')
on conflict do nothing;

create table if not exists creative_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  provider text not null check (provider in ('meta_ads', 'instagram', 'google_ads')),
  external_ad_id text not null,
  display_name text,
  thumbnail_url text,
  fingerprint jsonb not null default '{}'::jsonb check (jsonb_typeof(fingerprint) = 'object'),
  notes text,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'paused', 'retired')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, provider, external_ad_id)
);

create table if not exists creative_experiments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null check (char_length(name) between 2 and 140),
  hypothesis text not null check (char_length(hypothesis) between 8 and 2000),
  control_profile_id uuid references creative_profiles(id) on delete set null,
  variant_profile_id uuid references creative_profiles(id) on delete set null,
  primary_metric text not null default 'ctr' check (primary_metric in ('ctr', 'conversions', 'cpa', 'roas', 'engagement_rate')),
  target_improvement numeric(8,2),
  status text not null default 'planned' check (status in ('draft', 'planned', 'running', 'won', 'lost', 'inconclusive', 'cancelled')),
  start_date date,
  end_date date,
  owner_id uuid references profiles(id) on delete set null,
  content_item_id uuid references content_items(id) on delete set null,
  result_summary text,
  decision text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (control_profile_id is null or variant_profile_id is null or control_profile_id <> variant_profile_id)
);

create index if not exists creative_profiles_client_project_idx
  on creative_profiles(client_id, project_id, provider);
create index if not exists creative_profiles_project_idx
  on creative_profiles(project_id) where project_id is not null;
create index if not exists creative_profiles_created_by_idx
  on creative_profiles(created_by) where created_by is not null;
create index if not exists creative_experiments_client_status_idx
  on creative_experiments(client_id, status, created_at desc);
create index if not exists creative_experiments_project_idx
  on creative_experiments(project_id) where project_id is not null;
create index if not exists creative_experiments_control_idx
  on creative_experiments(control_profile_id) where control_profile_id is not null;
create index if not exists creative_experiments_variant_idx
  on creative_experiments(variant_profile_id) where variant_profile_id is not null;
create index if not exists creative_experiments_owner_idx
  on creative_experiments(owner_id) where owner_id is not null;
create index if not exists creative_experiments_content_item_idx
  on creative_experiments(content_item_id) where content_item_id is not null;
create index if not exists creative_experiments_created_by_idx
  on creative_experiments(created_by) where created_by is not null;
create index if not exists campaign_ad_metrics_client_date_idx
  on campaign_ad_metrics_daily(client_id, metric_date desc);

alter table creative_profiles enable row level security;
alter table creative_experiments enable row level security;

create policy "creative profiles permitted read" on creative_profiles for select
  to authenticated using (
    (has_permission((select auth.uid()), 'creative.read') or has_permission((select auth.uid()), 'creative.write'))
    and (
      coalesce((select my_role()) in ('owner', 'admin', 'manager', 'viewer'), false)
      or client_id in (select my_assigned_client_ids())
    )
  );
create policy "creative profiles permitted insert" on creative_profiles for insert
  to authenticated with check (
    has_permission((select auth.uid()), 'creative.write')
    and (
      coalesce((select my_role()) in ('owner', 'admin', 'manager'), false)
      or client_id in (select my_assigned_client_ids())
    )
  );
create policy "creative profiles permitted update" on creative_profiles for update
  to authenticated using (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  )
  with check (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  );
create policy "creative profiles permitted delete" on creative_profiles for delete
  to authenticated using (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  );

create policy "creative experiments permitted read" on creative_experiments for select
  to authenticated using (
    (has_permission((select auth.uid()), 'creative.read') or has_permission((select auth.uid()), 'creative.write'))
    and (
      coalesce((select my_role()) in ('owner', 'admin', 'manager', 'viewer'), false)
      or client_id in (select my_assigned_client_ids())
    )
  );
create policy "creative experiments permitted insert" on creative_experiments for insert
  to authenticated with check (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  );
create policy "creative experiments permitted update" on creative_experiments for update
  to authenticated using (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  )
  with check (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  );
create policy "creative experiments permitted delete" on creative_experiments for delete
  to authenticated using (
    has_permission((select auth.uid()), 'creative.write')
    and (coalesce((select my_role()) in ('owner', 'admin', 'manager'), false) or client_id in (select my_assigned_client_ids()))
  );

-- Data API access is explicit because new Supabase projects no longer expose
-- public tables automatically. RLS remains the authorization boundary.
grant select on creative_profiles, creative_experiments to authenticated;
grant insert, update, delete on creative_profiles, creative_experiments to authenticated;
grant select, insert, update, delete on creative_profiles, creative_experiments to service_role;
revoke all on creative_profiles, creative_experiments from anon;

drop trigger if exists creative_profiles_updated_at on creative_profiles;
create trigger creative_profiles_updated_at before update on creative_profiles
  for each row execute procedure update_updated_at();
drop trigger if exists creative_experiments_updated_at on creative_experiments;
create trigger creative_experiments_updated_at before update on creative_experiments
  for each row execute procedure update_updated_at();

-- Creative Lab can hand a new experiment to the visual workflow builder.
alter table automation_rules drop constraint if exists automation_rules_trigger_type_check;
alter table automation_rules add constraint automation_rules_trigger_type_check check (trigger_type in (
  'client_created', 'lead_won', 'quotation_accepted', 'invoice_paid',
  'task_completed', 'project_completed', 'creative_test_created', 'manual'
));

comment on table creative_profiles is 'Human-reviewed creative fingerprints linked to synced advertising assets.';
comment on table creative_experiments is 'Structured creative tests, approval handoffs, outcomes, and decisions.';
