alter table if exists public.icp_hypotheses
  add column if not exists offer_id uuid references public.offers(id) on delete set null,
  add column if not exists targeting_defaults jsonb,
  add column if not exists messaging_angle text,
  add column if not exists pattern_defaults jsonb,
  add column if not exists notes text;

create index if not exists icp_hypotheses_offer_id_idx
  on public.icp_hypotheses (offer_id);

alter table if exists public.campaigns
  add column if not exists icp_hypothesis_id uuid references public.icp_hypotheses(id) on delete set null;

create index if not exists campaigns_icp_hypothesis_id_idx
  on public.campaigns (icp_hypothesis_id);
