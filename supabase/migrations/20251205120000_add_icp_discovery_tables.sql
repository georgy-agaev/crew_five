create table if not exists public.icp_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  icp_profile_id uuid references public.icp_profiles(id) on delete set null,
  icp_hypothesis_id uuid references public.icp_hypotheses(id) on delete set null,
  provider text not null default 'exa',
  status text not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists icp_discovery_runs_job_idx on public.icp_discovery_runs (job_id);
create index if not exists icp_discovery_runs_icp_idx on public.icp_discovery_runs (icp_profile_id, icp_hypothesis_id);

create table if not exists public.icp_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.icp_discovery_runs(id) on delete cascade,
  candidate_name text,
  domain text,
  url text,
  country text,
  size_hint text,
  confidence numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists icp_discovery_candidates_run_idx on public.icp_discovery_candidates (run_id);

