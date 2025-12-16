alter table if exists public.prompt_registry
  add column if not exists prompt_text text;
