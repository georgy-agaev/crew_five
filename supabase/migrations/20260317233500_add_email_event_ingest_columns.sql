-- Add missing ingest/read columns expected by event ingestion and Inbox V2.

alter table if exists public.email_events
  add column if not exists provider text not null default 'unknown',
  add column if not exists reply_label text,
  add column if not exists idempotency_key text;

create index if not exists email_events_reply_label_idx on public.email_events (reply_label);
create unique index if not exists email_events_idempotency_key_key
  on public.email_events (idempotency_key)
  where idempotency_key is not null;
