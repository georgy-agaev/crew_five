create or replace view public.analytics_events_flat as
select
  ev.id as event_id,
  ev.event_type,
  ev.outcome_classification,
  ev.occurred_at,
  ev.provider_event_id,
  eo.id as outbound_id,
  eo.campaign_id,
  eo.draft_id,
  eo.contact_id,
  eo.company_id,
  d.metadata->>'draft_pattern' as draft_pattern,
  (d.metadata->>'user_edited')::boolean as user_edited,
  c.segment_id,
  c.segment_version,
  s.icp_profile_id,
  s.icp_hypothesis_id,
  e.position as role
from public.email_events ev
join public.email_outbound eo on ev.outbound_id = eo.id
left join public.drafts d on eo.draft_id = d.id
left join public.campaigns c on eo.campaign_id = c.id
left join public.segments s on c.segment_id = s.id
left join public.employees e on eo.contact_id = e.id;

