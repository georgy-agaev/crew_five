# Security: RLS disabled on Enrichment Supabase project

**Date:** 2026-04-01
**Status:** In Progress
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

### To Do

- Apply the migration to remote project `mxkouaqjvwmsdpdrdamo`.
- Re-run Security Advisors and confirm `rls_disabled_in_public` is cleared.

### Blocker

- Local `supabase db push --linked` currently fails with:
  `password authentication failed for user "cli_login_postgres" (SQLSTATE 28P01)`.
- The repository is linked to the correct project, but the locally cached DB login password is
  stale and must be refreshed before the remote migration can be applied through the CLI.
