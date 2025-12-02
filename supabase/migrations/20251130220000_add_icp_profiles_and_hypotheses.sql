create table if not exists public.icp_profiles (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    company_criteria jsonb,
    persona_criteria jsonb,
    created_by text,
    created_at timestamptz not null default now()
);

create table if not exists public.icp_hypotheses (
    id uuid primary key default gen_random_uuid(),
    icp_id uuid not null references public.icp_profiles(id) on delete cascade,
    hypothesis_label text not null,
    search_config jsonb,
    status text not null default 'draft' check (status in ('draft','active','deprecated')),
    created_at timestamptz not null default now()
);

alter table if exists public.segments
  add column if not exists icp_profile_id uuid references public.icp_profiles(id) on delete set null,
  add column if not exists icp_hypothesis_id uuid references public.icp_hypotheses(id) on delete set null;

