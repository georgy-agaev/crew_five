create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_name text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.campaigns
  add column if not exists offer_id uuid references public.offers(id) on delete set null;

create index if not exists campaigns_offer_id_idx on public.campaigns (offer_id);
