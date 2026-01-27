# Session: Database Schema Reference

Date: 2026-01-27

## Context

Needed a colleague-shareable description of the **current** Supabase database schema (all `public` tables and
their column-level schemas), aligned to the live database rather than stale migrations.

## Completed

- Introspected the live Supabase Postgres catalog for `public`:
  - Tables list (`information_schema.tables`)
  - Columns (type/nullability/defaults/comments)
  - Constraints (PK/UK/FK/CHECK)
  - Indexes (`pg_indexes`)
  - RLS state + policies (`pg_class`, `pg_policies`)
- Replaced `docs/Database_Description.md` with a full table-by-table schema reference for:
  - `ai_interactions`, `app_settings`, `campaigns`, `companies`, `drafts`, `email_events`, `email_outbound`,
    `employees`, `fallback_templates`, `icp_profiles`, `icp_hypotheses`, `jobs`, `prompt_registry`,
    `segment_members`, `segments`

## Notes

- Several tables have `relrowsecurity=true` but **no policies** in `pg_policies`. With RLS enabled, this means
  access is denied for non-owners unless writes/reads go through a role that bypasses RLS (e.g., service role).
- Many `updated_at` columns default to `now()` but will not automatically change on UPDATE without explicit writes
  or a trigger.
- “Row counts” in the reference use `pg_stat_user_tables.n_live_tup` (approximate).

## To Do

- If needed for onboarding, add a Mermaid ER diagram version of the “Quick Map” to `docs/Database_Description.md`.
- Decide which tables should be client-readable and add explicit RLS policies for those tables (instead of relying
  on service-role access).

