create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('send', 'enrich', 'sim')),
    status text not null check (status in ('created', 'running', 'completed', 'failed', 'not_implemented')),
    segment_id uuid references public.segments(id) on delete set null,
    segment_version integer,
    payload jsonb not null default '{}',
    result jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists jobs_type_status_idx on public.jobs (type, status);
create index if not exists jobs_segment_idx on public.jobs (segment_id, segment_version);

