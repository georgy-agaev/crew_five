# 2025-12-01 – Release Hardening & Migration Checks

> Timestamp (UTC): 2025-12-01T12:56:45Z  
> Goal: lock in the W0.v3 / W1.v2 / AN.v2 work by documenting migration
> application, adding quick verification helpers, and ensuring CLI help/docs
> reflect the current surface. No new legacy fallbacks.

## Overview
- Focus on readiness: migrations, docs, and quick checks for the new guards/FKs.
- Add lightweight validation helpers; no new product surface or legacy paths.

## To Do
- Migration readiness & verification
  - Files: `docs/Setup_Guide.md`, `README.md`.
  - Functions: none (doc-only).
  - Tests: none (manual step notes).

- Quick FK/view sanity helper (optional tiny helper)
  - Files: `tests/emailEvents.test.ts` (or new utility test), `tests/analytics.test.ts`.
  - Functions: `assertEmailEventFksPresent(client)` – helper to query `email_events`/view and fail if new FK columns are null for recent inserts.
  - Tests: `email_event_fks_are_present_for_recent_inserts` – inserts stub event and expects FKs surfaced in analytics view.

- CLI help/docs alignment
  - Files: `README.md`, `CHANGELOG.md`.
  - Functions: none.
  - Tests: none.

## Completed
- Added migration application notes to `docs/Setup_Guide.md` (commands + target migrations) and `README.md` (apply migrations note).
- Applied migrations to remote Supabase via `supabase db push` (non-destructive); analytics view refreshed with drop/create guard.
- Provider/model selections added to Web settings and threaded into draft generation calls; no additional migrations required (curated providers/models are validated client-side).
