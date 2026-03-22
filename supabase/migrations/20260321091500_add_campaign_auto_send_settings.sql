alter table public.campaigns
  add column if not exists auto_send_intro boolean not null default false,
  add column if not exists auto_send_bump boolean not null default false,
  add column if not exists bump_min_days_since_intro integer not null default 3;
