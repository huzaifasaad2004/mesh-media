create table if not exists public.campaign_ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.campaign_connections(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null check (provider in ('meta_ads', 'instagram', 'google_ads')),
  external_campaign_id text not null,
  campaign_name text not null,
  external_ad_group_id text,
  ad_group_name text,
  external_ad_id text not null,
  ad_name text,
  ad_type text,
  ad_status text,
  metric_date date not null,
  currency text not null default 'AED',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  engagements bigint not null default 0,
  video_views bigint not null default 0,
  conversions numeric not null default 0,
  spend numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  creative jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (connection_id, external_ad_id, metric_date)
);

create table if not exists public.campaign_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  period_start date not null,
  period_end date not null,
  timezone text not null default 'Asia/Dubai',
  filters jsonb not null default '{}'::jsonb,
  commentary text,
  pdf_storage_path text,
  audio_storage_path text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'sent')),
  sent_to text,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists campaign_ad_metrics_scope_date_idx on public.campaign_ad_metrics_daily (client_id, project_id, metric_date desc);
create index if not exists campaign_reports_client_created_idx on public.campaign_reports (client_id, created_at desc);

alter table public.campaign_ad_metrics_daily enable row level security;
alter table public.campaign_reports enable row level security;

create policy "campaign ad metrics staff read" on public.campaign_ad_metrics_daily for select to authenticated using ((select public.is_staff()));
create policy "campaign ad metrics client read" on public.campaign_ad_metrics_daily for select to authenticated using (client_id in (select public.my_client_ids()));
create policy "campaign reports staff read" on public.campaign_reports for select to authenticated using ((select public.is_staff()));
create policy "campaign reports client read" on public.campaign_reports for select to authenticated using (client_id in (select public.my_client_ids()));

revoke all on public.campaign_ad_metrics_daily from anon;
revoke all on public.campaign_reports from anon;
grant select on public.campaign_ad_metrics_daily to authenticated;
grant select on public.campaign_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-reports', 'campaign-reports', false, 26214400, array['application/pdf','audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
