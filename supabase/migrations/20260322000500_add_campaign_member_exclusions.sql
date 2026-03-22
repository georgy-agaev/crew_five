create table if not exists public.campaign_member_exclusions (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    company_id uuid null references public.companies(id) on delete set null,
    contact_id uuid not null references public.employees(id) on delete cascade,
    source text not null default 'next_wave_exclusion',
    reason text null,
    excluded_by text null,
    metadata jsonb null,
    excluded_at timestamptz not null default now(),
    unique (campaign_id, contact_id)
);

create index if not exists campaign_member_exclusions_campaign_idx
    on public.campaign_member_exclusions (campaign_id);

create index if not exists campaign_member_exclusions_campaign_company_idx
    on public.campaign_member_exclusions (campaign_id, company_id);

create index if not exists campaign_member_exclusions_campaign_contact_idx
    on public.campaign_member_exclusions (campaign_id, contact_id);
