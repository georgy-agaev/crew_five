alter table public.campaigns
  add column if not exists send_timezone text not null default 'Europe/Moscow',
  add column if not exists send_window_start_hour integer not null default 9,
  add column if not exists send_window_end_hour integer not null default 17,
  add column if not exists send_weekdays_only boolean not null default true;
