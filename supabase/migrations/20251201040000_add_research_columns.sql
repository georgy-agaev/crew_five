alter table if exists public.companies
  add column if not exists company_research jsonb;

alter table if exists public.employees
  add column if not exists ai_research_data jsonb;

