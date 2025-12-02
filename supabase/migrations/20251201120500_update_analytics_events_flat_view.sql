drop view if exists public.analytics_events_flat;

create view public.analytics_events_flat as
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
