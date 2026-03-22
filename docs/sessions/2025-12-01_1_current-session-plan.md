# 2025-12-01 – Session Plan for W0.v3/W1.v2 Exposure

> Timestamp (UTC): 2025-12-01T11:16:19Z  
> Goal: Surface the already-built W0.v3 enrichment and W1.v2 coach flows in
> the CLI, tighten analytics wiring, and keep Option 2 SIM stub untouched.

## Overview
- Focus only on exposing the functionality we have: job-based enrichment and
  ICP-aware draft generation.
- Avoid new legacy fallbacks; keep existing sync paths only where needed for
  safety/dry-run.
- Keep docs/session log aligned; no schema or prompt changes expected.

## Options
- Option A – Minimal CLI exposure: add flags/commands, lean on existing sync
  paths, no new queues.
- Option B – Prefer async job path: default to enqueue + run-once helper with
  optional `--run-now`; keep sync as `--legacy`.
- Option C – Docs-first: document flows and add thin wrappers later (least
  engineering, slower validation).

## To Do
- SIM CLI surface intentionally deferred (Option 3); keep service-level stub only.

- Segment version correctness (blocking)
  - Enforce snapshot existence for the specific `campaign.segment_version`; error if `segment.version` advanced unless `--force-version`.
  - Files: `src/commands/draftGenerate.ts`, `src/commands/enrich.ts`, `src/services/segmentSnapshotWorkflow.ts`, `tests/draftCommand.test.ts`, `tests/enrichment.test.ts`.
  - Tests: campaign/segment mismatch rejects without force; runs when aligned.

- Event FK population for analytics
  - Populate new `email_events` FK columns (draft_id, send_job_id, segment_id, segment_version, employee_id, icp_profile_id, icp_hypothesis_id, pattern_id, coach_prompt_id) during ingest; prefer event FKs in analytics view.
  - Files: `src/services/emailEvents.ts`, `supabase/migrations/*add_email_event_fk_columns.sql`, `supabase/migrations/20251201043000_add_analytics_events_flat_view.sql`, `tests/emailEvents.test.ts`, `tests/analytics.test.ts`.
  - Tests: events carry FKs; analytics summary exposes them; dedupe remains stable.

- Idempotency reliability for events without provider_event_id
  - Hash stable tuple (provider, event_type, outbound_id, contact_id, occurred_at) instead of random UUID.
  - Files: `src/services/emailEvents.ts`, `tests/emailEvents.test.ts`.

- Enrichment legacy path handling
  - Keep async default; mark legacy sync deprecated; share adapter/write logic to avoid drift.
  - Files: `src/commands/enrich.ts`, `tests/enrichment.test.ts`, `tests/cli.test.ts`.

- ICP list safety
  - Whitelist allowed columns for `icp:list` and `icp:hypothesis:list`; reject unknowns.
  - Files: `src/commands/icpList.ts`, `tests/icpListCommand.test.ts`, `tests/cli.test.ts`.

- Docs/CHANGELOG
  - Update README CLI snippets; changelog entry for these fixes.

## Recommendations (pick an option per item)
- Priorities/critical path: pick Option 1 – tighten P0 to enrich CLI + ICP flags; defer carryovers to P1 unless unblocked.
- Enrich path choice: pick Option 1 – lock to async enqueue + `--run-now`; keep sync only as `--legacy`.
- Final snapshot guard: pick Option 1 – enforce `ensureFinalSegmentSnapshot` in enrich and draft commands (hard fail).
- Analytics output: pick Option 2 – add JSON shape snapshot tests per `--group-by` and include ICP/pattern keys.
- ICP list UX: pick Option 1 – keep list-only but add `--json`/`--columns` for scripting.
- SIM stub CLI: pick Option 3 – skip CLI; keep service-level stub + test only.
- Email events FK remediation: pick Option 1 – schema assertion + migration guard to add missing FKs if absent.
- Testing depth: pick Option 1 – add dry-run + misconfig cases for enrich/draft flags this session.
- Documentation: pick Option 2 – update `CHANGELOG.md` plus examples in `README` once flags ship.
- Config/flags hygiene: pick Option 1 – centralize defaults in a config helper and print resolved mode in CLI output.

## Completed
- Final snapshot guard added via `ensureFinalSegmentSnapshot` with tests to block enrichment/draft runs on unfinalized segments.
- Enrichment CLI defaults to async job enqueue with optional `--run-now` and `--legacy-sync`; snapshot guard enforced; summaries include resolved mode; tests updated.
- Draft generation CLI supports ICP flags and uses coach helper when provided; enforces finalized snapshot; draft metadata now carries ICP IDs; tests updated.
- Analytics summary uses `formatAnalyticsOutput` plus JSON shape test for pattern grouping.
- Email events FK remediation: `mapProviderEvent` now carries analytics keys; added migration `20251201120000_add_email_event_fk_columns.sql`; schema/test coverage added.
- ICP list commands added (`icp:list`, `icp:hypothesis:list`) with column filtering and CLI wiring; tests added.
- README updated with new CLI flags/commands; full `pnpm vitest run` passing (185 tests).
- Campaign/segment version guardrails enforced on draft/enrich; force-version flag added to draft CLI.
- Email events now auto-enrich analytics FKs from outbound/draft/campaign context; idempotency uses stable hashes; analytics view updated to prefer event-level FKs; migrations and tests added.
- ICP list commands now whitelist columns to avoid invalid selects.
