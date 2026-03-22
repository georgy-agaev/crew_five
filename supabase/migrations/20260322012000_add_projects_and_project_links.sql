create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists projects_key_uidx
  on public.projects (key);

alter table if exists public.icp_profiles
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists icp_profiles_project_id_idx
  on public.icp_profiles (project_id);

alter table if exists public.offers
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists offers_project_id_idx
  on public.offers (project_id);

alter table if exists public.campaigns
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists campaigns_project_id_idx
  on public.campaigns (project_id);
