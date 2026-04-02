# Security: RLS disabled on Enrichment Supabase project

**Date:** 2026-04-01
**Status:** Completed
**Owner:** backend / Codex
**Severity:** Critical — Supabase sends weekly warnings since January 2026

## Problem

Supabase detects that Row Level Security (RLS) is **not enabled** on tables in the public schema
of the **Enrichment** project. This means any client with the project URL and anon key can
read/write data through PostgREST without authorization.

## Source

Weekly email from Supabase to georgy.agaev@gmail.com:
- Subject: "Security vulnerabilities detected in your Supabase projects"
- First received: 2026-01-29
- Last received: 2026-03-24
- **6 warnings total** — not addressed yet

## Affected Project

- **Name:** Enrichment
- **Ref:** `mxkouaqjvwmsdpdrdamo`
- **Dashboard:** https://supabase.com/dashboard/project/mxkouaqjvwmsdpdrdamo/advisors/security

## Issue Details

- **Code:** `rls_disabled_in_public`
- **Severity:** Critical
- **Description:** Tables in schemas exposed to PostgREST have no RLS policies enabled

## What to Check

1. Open the Security Advisors page in Supabase dashboard (link above)
2. Review which tables have RLS disabled
3. For each table, decide:
   - **If used by crew_five services via service_role key only** → RLS can be enabled with a
     permissive policy for `service_role`, or tables can be moved out of the public schema
   - **If not used** → drop or move to a non-public schema
   - **If intentionally public** → document why and suppress the warning

## Recommended Fix

Since crew_five connects with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), enabling RLS
on all tables should not break anything. The simplest fix:

```sql
-- For each table without RLS:
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

This blocks anonymous/anon-key access while service_role continues to work.

## Verification

After enabling RLS:
- Supabase Security Advisors page should show no critical issues
- `pnpm test` should still pass (service_role bypasses RLS)
- Weekly warning emails should stop

## Current Implementation Status

### Completed

- Added repo migration
  [20260402101500_enable_public_table_rls.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260402101500_enable_public_table_rls.sql)
  covering all currently affected tables:
  - `public.app_settings`
  - `public.campaign_mailbox_assignments`
  - `public.campaign_member_additions`
  - `public.campaign_member_exclusions`
  - `public.employee_data_repairs`
  - `public.icp_discovery_candidates`
  - `public.icp_discovery_runs`
  - `public.offers`
  - `public.projects`
- Re-verified the current advisory state via Supabase Security Advisors and confirmed these are the
  only remaining `rls_disabled_in_public` tables.

### Completed Verification

- Applied the migration to remote project `mxkouaqjvwmsdpdrdamo` via:
  `supabase db push --linked`
- Confirmed `supabase migration list --linked` shows
  `20260402101500_enable_public_table_rls.sql` on both local and remote.
- Re-checked table state: all nine previously affected tables now have `rowsecurity = true`.
- Re-ran Supabase Security Advisors and confirmed `rls_disabled_in_public` findings are gone.

### Completed Follow-up Hardening

- Added repo migration
  [20260402143000_harden_remaining_security_advisors.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260402143000_harden_remaining_security_advisors.sql)
  to clear the remaining SQL-level security findings:
  - recreated `public.analytics_events_flat` with `security_invoker = true`
  - recreated `public.outreach_campaigns` with `security_invoker = true`
  - recreated `public.set_updated_at()` with `SET search_path = ''`
  - recreated `public.update_updated_at_column()` with `SET search_path = ''`
  - dropped the overly permissive `Allow all for authenticated users` policies on
    `public.companies` and `public.employees`
- Applied the migration to remote project `mxkouaqjvwmsdpdrdamo` via:
  `supabase db push --linked`
- Re-checked Supabase Security Advisors and confirmed these findings are gone:
  - `security_definer_view`
  - `function_search_path_mutable`
  - `rls_policy_always_true`

### Remaining Security Work

The critical exposed-table issue and the SQL-level hardening issues are now closed. Remaining
advisor output is:

- `rls_enabled_no_policy` informational findings on RLS-enabled tables
  These are expected for our `service_role`-only backend pattern and do not expose browser access.
- `vulnerable_postgres_version`
  This is platform-managed and requires a Supabase Postgres upgrade, not a repo migration.
