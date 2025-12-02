-- Add analytics-friendly foreign keys to email_events

alter table if exists public.email_events
  add column if not exists draft_id uuid references public.drafts(id) on delete set null,
  add column if not exists send_job_id uuid references public.jobs(id) on delete set null,
  add column if not exists segment_id uuid references public.segments(id) on delete set null,
  add column if not exists segment_version integer,
  add column if not exists employee_id uuid references public.employees(id) on delete set null,
  add column if not exists icp_profile_id uuid references public.icp_profiles(id) on delete set null,
  add column if not exists icp_hypothesis_id uuid references public.icp_hypotheses(id) on delete set null,
  add column if not exists pattern_id text,
  add column if not exists coach_prompt_id text;

create index if not exists email_events_draft_idx on public.email_events (draft_id);
create index if not exists email_events_segment_idx on public.email_events (segment_id, segment_version);
create index if not exists email_events_employee_idx on public.email_events (employee_id);
