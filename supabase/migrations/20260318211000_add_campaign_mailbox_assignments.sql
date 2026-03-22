create table if not exists public.campaign_mailbox_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  mailbox_account_id text,
  sender_identity text not null,
  provider text not null default 'imap_mcp',
  source text,
  metadata jsonb,
  assigned_at timestamptz not null default now(),
  unique (campaign_id, sender_identity)
);

create index if not exists campaign_mailbox_assignments_campaign_idx
  on public.campaign_mailbox_assignments (campaign_id);

create index if not exists campaign_mailbox_assignments_mailbox_idx
  on public.campaign_mailbox_assignments (mailbox_account_id);
