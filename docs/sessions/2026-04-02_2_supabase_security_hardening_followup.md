# Session Note - Supabase Security Hardening Follow-up

**Date:** 2026-04-02  
**Status:** Completed

## Completed

- Added migration
  [20260402143000_harden_remaining_security_advisors.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260402143000_harden_remaining_security_advisors.sql)
  to clear the remaining SQL-level Supabase Security Advisor findings for project
  `mxkouaqjvwmsdpdrdamo`.
- Recreated `public.analytics_events_flat` and `public.outreach_campaigns` with
  `security_invoker = true`.
- Recreated `public.set_updated_at()` and `public.update_updated_at_column()` with
  `SET search_path = ''`.
- Dropped the permissive `Allow all for authenticated users` policies from
  `public.companies` and `public.employees`.
- Applied the migration remotely with `supabase db push --linked`.
- Verified:
  - both views now have `security_invoker=true`
  - both helper functions now have fixed `search_path`
  - the permissive `companies` / `employees` policies are gone
  - Supabase Security Advisors no longer report:
    - `security_definer_view`
    - `function_search_path_mutable`
    - `rls_policy_always_true`

## Remaining

- `rls_enabled_no_policy` informational findings on RLS-enabled tables remain and are expected for
  the current `service_role`-only backend architecture.
- `vulnerable_postgres_version` remains and must be resolved through a managed Supabase Postgres
  upgrade rather than a repository migration.
