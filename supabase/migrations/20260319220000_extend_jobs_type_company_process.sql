alter table if exists public.jobs
  drop constraint if exists jobs_type_check;

alter table if exists public.jobs
  add constraint jobs_type_check
  check (type in ('send','enrich','sim','icp','company_process'));
