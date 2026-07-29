alter table public.campaign_reports
  add column if not exists public_token uuid unique default gen_random_uuid(),
  add column if not exists public_expires_at timestamptz,
  add column if not exists language text not null default 'en' check (language in ('en','ar','bilingual')),
  add column if not exists executive_summary jsonb not null default '{}'::jsonb,
  add column if not exists internal_notes text,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists download_count integer not null default 0;

alter table public.campaign_reports drop constraint if exists campaign_reports_status_check;
alter table public.campaign_reports add constraint campaign_reports_status_check check (status in ('draft','review','approved','ready','sent'));

create table if not exists public.campaign_report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete cascade,
  sections jsonb not null default '["executive","performance","campaigns","creatives","recommendations"]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  language text not null default 'en' check (language in ('en','ar','bilingual')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_report_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  template_id uuid references public.campaign_report_templates(id) on delete set null,
  cadence text not null check (cadence in ('weekly','monthly')),
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  timezone text not null default 'Asia/Dubai',
  recipient_emails text[] not null default '{}',
  language text not null default 'en' check (language in ('en','ar','bilingual')),
  enabled boolean not null default true,
  last_sent_at timestamptz,
  next_run_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_reports_public_token_idx on public.campaign_reports(public_token);
create index if not exists campaign_report_templates_client_idx on public.campaign_report_templates(client_id);
create index if not exists campaign_report_schedules_client_idx on public.campaign_report_schedules(client_id);
create index if not exists campaign_report_schedules_project_idx on public.campaign_report_schedules(project_id);
create index if not exists campaign_report_schedules_template_idx on public.campaign_report_schedules(template_id);
create index if not exists campaign_report_schedules_due_idx on public.campaign_report_schedules(enabled, next_run_at);

alter table public.campaign_report_templates enable row level security;
alter table public.campaign_report_schedules enable row level security;

create policy "campaign templates staff read" on public.campaign_report_templates for select to authenticated using ((select public.is_staff()));
create policy "campaign schedules staff read" on public.campaign_report_schedules for select to authenticated using ((select public.is_staff()));

revoke all on public.campaign_report_templates from anon;
revoke all on public.campaign_report_schedules from anon;
grant select on public.campaign_report_templates to authenticated;
grant select on public.campaign_report_schedules to authenticated;
