-- Hardening follow-up for remaining Supabase Security Advisor findings.
-- This migration fixes:
-- 1. security_definer_view on public.analytics_events_flat and public.outreach_campaigns
-- 2. function_search_path_mutable on public.set_updated_at and public.update_updated_at_column
-- 3. overly permissive authenticated policies on public.companies and public.employees

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace view public.analytics_events_flat
with (security_invoker = true) as
select
  ev.id as event_id,
  ev.event_type,
  ev.outcome_classification,
  ev.occurred_at,
  ev.provider_event_id,
  coalesce(ev.draft_id, eo.draft_id) as draft_id,
  ev.send_job_id,
  eo.id as outbound_id,
  eo.campaign_id,
  coalesce(ev.segment_id, c.segment_id) as segment_id,
  coalesce(ev.segment_version, c.segment_version) as segment_version,
  coalesce(ev.icp_profile_id, s.icp_profile_id) as icp_profile_id,
  coalesce(ev.icp_hypothesis_id, s.icp_hypothesis_id) as icp_hypothesis_id,
  coalesce(ev.pattern_id, d.metadata->>'draft_pattern') as draft_pattern,
  coalesce(ev.coach_prompt_id, d.metadata->>'coach_prompt_id') as coach_prompt_id,
  (d.metadata->>'user_edited')::boolean as user_edited,
  coalesce(ev.employee_id, eo.contact_id) as employee_id,
  e.position as role
from public.email_events ev
join public.email_outbound eo on ev.outbound_id = eo.id
left join public.drafts d on coalesce(ev.draft_id, eo.draft_id) = d.id
left join public.campaigns c on eo.campaign_id = c.id
left join public.segments s on coalesce(ev.segment_id, c.segment_id) = s.id
left join public.employees e on coalesce(ev.employee_id, eo.contact_id) = e.id;

create or replace view public.outreach_campaigns
with (security_invoker = true) as
select
  campaign_number,
  outreach_type,
  count(*) as total_contacts,
  count(case when reply_unsubscribe then 1 else null end) as unsubscribes,
  count(case when reply_info_request then 1 else null end) as info_requests,
  count(case when reply_bounce then 1 else null end) as bounces,
  count(case when client_status then 1 else null end) as conversions,
  round(
    (count(case when client_status then 1 else null end)::numeric / count(*)::numeric) * 100,
    2
  ) as conversion_rate,
  min(outreach_sent_date) as campaign_start_date,
  max(outreach_sent_date) as campaign_end_date
from public.employees
where campaign_number is not null
group by campaign_number, outreach_type
order by campaign_number;

drop policy if exists "Allow all for authenticated users" on public.companies;
drop policy if exists "Allow all for authenticated users" on public.employees;
