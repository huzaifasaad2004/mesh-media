-- Finance/tasks/team/contracts audit follow-up.
alter table public.tasks
  add column if not exists reference_url text;

-- Restore creator attribution for older tasks when the audit log captured it.
update public.tasks task
set created_by = (
  select log.actor_id
  from public.activity_log log
  where log.entity_type = 'task'
    and log.action = 'create'
    and log.entity_id = task.id::text
    and log.actor_id is not null
  order by log.created_at asc
  limit 1
)
where task.created_by is null
  and exists (
    select 1 from public.activity_log log
    where log.entity_type = 'task'
      and log.action = 'create'
      and log.entity_id = task.id::text
      and log.actor_id is not null
  );

alter table public.tasks
  drop constraint if exists tasks_reference_url_check;
alter table public.tasks
  add constraint tasks_reference_url_check
  check (
    reference_url is null
    or reference_url ~ '^https://(drive|docs)\.google\.com/'
  );

alter table public.profiles
  add column if not exists archived_at timestamptz;

create index if not exists profiles_active_role_idx
  on public.profiles (role)
  where archived_at is null;

alter table public.contracts
  add column if not exists signable_document_id uuid
  references public.signable_documents(id) on delete set null;

create index if not exists contracts_signable_document_idx
  on public.contracts (signable_document_id)
  where signable_document_id is not null;
