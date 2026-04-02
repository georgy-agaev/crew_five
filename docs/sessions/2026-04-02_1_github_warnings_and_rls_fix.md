# Session Note - GitHub Warnings And RLS Fix

**Date:** 2026-04-02  
**Status:** Completed

## Completed

- Fixed the failing GitHub `Security Checks` lint path for the public landing-page script by
  declaring browser globals in
  [eslint.config.js](/Users/georgyagaev/crew_five/eslint.config.js).
- Updated GitHub workflow configuration to run on Node 24 action/runtime in:
  - [security-checks.yml](/Users/georgyagaev/crew_five/.github/workflows/security-checks.yml)
  - [pages.yml](/Users/georgyagaev/crew_five/.github/workflows/pages.yml)
- Replaced deprecated `pnpm/action-setup` and `gitleaks-action` workflow usage in the security job
  with `corepack`-managed pnpm setup and direct `gitleaks` CLI execution, removing the remaining
  Node 20 action-runtime warnings.
- Narrowed dependency-audit suppression to the single upstream
  `date-holidays -> lodash` advisory `GHSA-r5fr-rjxr-66jc` so CI remains blocking for all other
  new high-severity production issues.
- Removed the stale tracked `.orchestrator-kit` gitlink from the repository index and added
  `.orchestrator-kit/` to
  [\.gitignore](/Users/georgyagaev/crew_five/.gitignore) so Actions no longer treats it as a
  broken submodule.
- Added migration
  [20260402101500_enable_public_table_rls.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260402101500_enable_public_table_rls.sql)
  to enable RLS on all remaining exposed `public` tables flagged by Supabase Security Advisors.
- Applied the migration to remote project `mxkouaqjvwmsdpdrdamo` and verified the remote
  migration history now includes `20260402101500`.
- Re-checked Supabase Security Advisors and confirmed the `rls_disabled_in_public` errors are
  resolved.

## Follow-up

- Remaining Supabase security advisories are non-blocking follow-up hardening items:
  `rls_enabled_no_policy`, `security_definer_view`, `function_search_path_mutable`,
  permissive RLS policies on `companies` / `employees`, and the managed Postgres upgrade warning.
