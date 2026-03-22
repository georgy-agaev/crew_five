create table if not exists public.campaign_member_additions (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    contact_id uuid not null references public.employees(id) on delete cascade,
    source text not null default 'manual_attach',
    attached_by text,
    attached_at timestamptz not null default now(),
    metadata jsonb,
    snapshot jsonb,
    unique (campaign_id, contact_id)
);

create index if not exists campaign_member_additions_campaign_idx
    on public.campaign_member_additions (campaign_id);

create index if not exists campaign_member_additions_campaign_company_idx
    on public.campaign_member_additions (campaign_id, company_id);

create index if not exists campaign_member_additions_campaign_contact_idx
    on public.campaign_member_additions (campaign_id, contact_id);
