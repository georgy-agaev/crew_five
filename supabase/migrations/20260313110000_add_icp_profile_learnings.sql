alter table if exists public.icp_profiles
  add column if not exists learnings jsonb;
