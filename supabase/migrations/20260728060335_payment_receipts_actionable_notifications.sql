alter table public.invoices
  add column if not exists payment_receipt_claimed_at timestamptz,
  add column if not exists payment_receipt_sent_at timestamptz,
  add column if not exists payment_receipt_email_id text;

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists available_actions text[] not null default '{}',
  add column if not exists action_completed_at timestamptz,
  add column if not exists action_completed_by uuid references public.profiles(id) on delete set null;

alter table public.notifications
  add constraint notifications_entity_type_check
    check (entity_type is null or entity_type in ('approval', 'task')),
  add constraint notifications_available_actions_check
    check (available_actions <@ array['approve', 'reject', 'complete', 'reply']::text[]);

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id)
  where entity_id is not null;
