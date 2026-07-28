-- Campaign reporting connections are deliberately not exposed through the
-- Data API. OAuth credentials are encrypted by the application before they
-- reach this table and are only read with the server-side service role.
create table if not exists public.campaign_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null check (provider in ('meta_ads', 'instagram', 'google_ads')),
  external_account_id text not null,
  account_name text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, provider, external_account_id)
);

create table if not exists public.campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.campaign_connections(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null check (provider in ('meta_ads', 'instagram', 'google_ads')),
  external_campaign_id text not null,
  campaign_name text not null,
  metric_date date not null,
  currency text not null default 'AED',
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  engagements bigint not null default 0,
  video_views bigint not null default 0,
  leads numeric not null default 0,
  conversions numeric not null default 0,
  spend numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (connection_id, external_campaign_id, metric_date)
);

create table if not exists public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  budget numeric(14,2),
  target_impressions bigint,
  target_reach bigint,
  target_clicks bigint,
  target_leads numeric,
  target_conversions numeric,
  target_revenue numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (client_id, project_id, period_start, period_end)
);

create index if not exists campaign_connections_client_project_idx
  on public.campaign_connections (client_id, project_id, provider);
create index if not exists campaign_metrics_client_date_idx
  on public.campaign_metrics_daily (client_id, metric_date desc);
create index if not exists campaign_metrics_project_date_idx
  on public.campaign_metrics_daily (project_id, metric_date desc)
  where project_id is not null;
create index if not exists campaign_targets_client_period_idx
  on public.campaign_targets (client_id, period_start desc);

alter table public.campaign_connections enable row level security;
alter table public.campaign_metrics_daily enable row level security;
alter table public.campaign_targets enable row level security;

-- Metrics and targets can be read by staff, and by a portal user linked to
-- the same client. Writes go through authenticated server routes only.
create policy "campaign metrics staff read" on public.campaign_metrics_daily
  for select to authenticated using ((select public.is_staff()));
create policy "campaign metrics client read" on public.campaign_metrics_daily
  for select to authenticated using (client_id in (select public.my_client_ids()));
create policy "campaign targets staff read" on public.campaign_targets
  for select to authenticated using ((select public.is_staff()));
create policy "campaign targets client read" on public.campaign_targets
  for select to authenticated using (client_id in (select public.my_client_ids()));

revoke all on public.campaign_connections from anon, authenticated;
revoke all on public.campaign_metrics_daily from anon;
revoke all on public.campaign_targets from anon;
grant select on public.campaign_metrics_daily to authenticated;
grant select on public.campaign_targets to authenticated;
