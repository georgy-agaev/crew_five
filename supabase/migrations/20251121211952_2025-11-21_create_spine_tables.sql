-- Spine tables migration generated on 2025-11-21

create table if not exists public.segments (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    locale text default 'en',
    filter_definition jsonb not null,
    version integer not null default 1,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists segments_name_idx on public.segments using gin (to_tsvector('simple', coalesce(name,'')));
create index if not exists segments_locale_idx on public.segments (locale);

create table if not exists public.segment_members (
    id uuid primary key default gen_random_uuid(),
    segment_id uuid not null references public.segments(id) on delete cascade,
    segment_version integer not null,
    contact_id uuid not null references public.employees(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    snapshot jsonb not null,
    added_at timestamptz not null default now(),
    unique (segment_id, contact_id)
);

create index if not exists segment_members_segment_idx on public.segment_members (segment_id);
create index if not exists segment_members_contact_idx on public.segment_members (contact_id);

create table if not exists public.campaigns (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    segment_id uuid not null references public.segments(id) on delete restrict,
    segment_version integer not null,
    sender_profile_id uuid,
    prompt_pack_id uuid,
    status text not null default 'draft' check (status in ('draft','ready','generating','review','scheduled','sending','complete','paused')),
    interaction_mode text not null default 'express' check (interaction_mode in ('express','coach')),
    data_quality_mode text not null default 'strict' check (data_quality_mode in ('strict','graceful')),
    schedule jsonb,
    throttle jsonb,
    metadata jsonb,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists campaigns_segment_idx on public.campaigns (segment_id);
create index if not exists campaigns_status_idx on public.campaigns (status);

create table if not exists public.drafts (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    contact_id uuid not null references public.employees(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    email_type text not null,
    language text not null,
    pattern_mode text,
    variant_label text,
    subject text,
    body text,
    ai_score numeric,
    ai_sdk_request_id text,
    status text not null default 'generated' check (status in ('generated','approved','rejected','sent')),
    reviewer text,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists drafts_campaign_status_idx on public.drafts (campaign_id, status);
create index if not exists drafts_contact_idx on public.drafts (contact_id);

create table if not exists public.email_outbound (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid references public.campaigns(id) on delete set null,
    draft_id uuid references public.drafts(id) on delete set null,
    contact_id uuid references public.employees(id) on delete set null,
    company_id uuid references public.companies(id) on delete set null,
    provider text not null,
    provider_message_id text,
    sender_identity text,
    pattern_mode text,
    persona_cluster text,
    status text not null default 'queued' check (status in ('queued','sent','failed')),
    sent_at timestamptz default now(),
    error text,
    metadata jsonb,
    unique (provider, provider_message_id)
);

create index if not exists email_outbound_campaign_idx on public.email_outbound (campaign_id);
create index if not exists email_outbound_contact_idx on public.email_outbound (contact_id);

create table if not exists public.email_events (
    id uuid primary key default gen_random_uuid(),
    outbound_id uuid not null references public.email_outbound(id) on delete cascade,
    event_type text not null check (event_type in ('delivered','opened','clicked','replied','bounced','unsubscribed','complaint')),
    outcome_classification text check (outcome_classification in ('meeting','soft_interest','decline','angry','neutral')),
    provider_event_id text,
    occurred_at timestamptz not null default now(),
    payload jsonb,
    created_at timestamptz not null default now()
);

create index if not exists email_events_outbound_idx on public.email_events (outbound_id);
create index if not exists email_events_event_type_idx on public.email_events (event_type);

create table if not exists public.fallback_templates (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    locale text not null default 'en',
    payload jsonb not null,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (category, locale)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_segments_updated
before update on public.segments
for each row execute function public.set_updated_at();

create trigger set_campaigns_updated
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger set_drafts_updated
before update on public.drafts
for each row execute function public.set_updated_at();

create trigger set_fallback_templates_updated
before update on public.fallback_templates
for each row execute function public.set_updated_at();
