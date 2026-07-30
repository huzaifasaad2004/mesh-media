-- Task reference images: private Storage objects plus RLS-scoped metadata.
-- Apply before deploying the matching application code.

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 3145728),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.task_attachments enable row level security;

create index if not exists task_attachments_task_created_idx
  on public.task_attachments (task_id, created_at);
create index if not exists task_attachments_uploaded_by_idx
  on public.task_attachments (uploaded_by);

drop policy if exists "task attachments read scoped" on public.task_attachments;
create policy "task attachments read scoped"
  on public.task_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks task
      where task.id = task_attachments.task_id
        and (
          (select public.my_role()) in ('owner', 'admin', 'manager', 'viewer')
          or ((select public.my_role()) = 'member' and task.assigned_to = (select auth.uid()))
        )
    )
  );

-- Uploads and deletes go through permission-checked server routes using the
-- service role. Authenticated clients only need RLS-scoped metadata reads.
revoke all on table public.task_attachments from anon;
revoke insert, update, delete on table public.task_attachments from authenticated;
grant select on table public.task_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are intentional: only the trusted server can
-- mutate objects or mint short-lived URLs after checking task visibility.
