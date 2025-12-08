alter table if exists public.prompt_registry
  add column if not exists step text;

alter table if exists public.prompt_registry
  drop constraint if exists prompt_registry_rollout_status_check;

alter table if exists public.prompt_registry
  add constraint prompt_registry_rollout_status_check
  check (rollout_status in ('pilot','active','retired','deprecated'));

