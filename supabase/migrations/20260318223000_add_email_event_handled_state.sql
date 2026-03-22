alter table if exists public.email_events
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by text;

create index if not exists email_events_handled_at_idx
  on public.email_events (handled_at);
