-- Enable RLS on public tables that are exposed via PostgREST but only accessed
-- by crew_five server-side processes through the service_role key.
alter table public.app_settings enable row level security;
alter table public.campaign_mailbox_assignments enable row level security;
alter table public.campaign_member_additions enable row level security;
alter table public.campaign_member_exclusions enable row level security;
alter table public.employee_data_repairs enable row level security;
alter table public.icp_discovery_candidates enable row level security;
alter table public.icp_discovery_runs enable row level security;
alter table public.offers enable row level security;
alter table public.projects enable row level security;
