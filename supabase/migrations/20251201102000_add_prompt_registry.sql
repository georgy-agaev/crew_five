create table if not exists public.prompt_registry (
    id uuid primary key default gen_random_uuid(),
    coach_prompt_id text not null,
    description text,
    version text,
    rollout_status text not null default 'active' check (rollout_status in ('active','deprecated')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists prompt_registry_coach_prompt_id_idx on public.prompt_registry (coach_prompt_id);

