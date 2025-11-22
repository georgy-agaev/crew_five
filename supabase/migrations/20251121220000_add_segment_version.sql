alter table if exists public.segments
  add column if not exists version integer not null default 1;
