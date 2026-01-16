# Session Plan – 2025-11-23 21:24:02

## Overview
Finish Phase 1 blocking items: solidify campaign status transitions/guards and add a draft generation orchestrator using the existing AI stub. No legacy fallback work.

## Plan
- Enforce the status transition map in campaign updates/status changes and expose a minimal status change CLI with clear errors and fail-fast option.
- Add a draft orchestrator that reads segment members, calls AI stub, writes drafts, and updates statuses; include dry-run and fail-fast options.
- Update docs/changelog/session log to capture new commands and behaviors.

## Files to Touch
- `src/status.ts`, `src/services/campaigns.ts` – enforce status transitions/guards with error codes.
- `src/cli.ts` + new command module – `campaign:status` command wiring (minimal transitions).
- `src/services/drafts.ts`, `src/commands/draftGenerate.ts` – orchestrator logic/dry-run/fail-fast.
- `tests/campaigns.test.ts`, `tests/cli.test.ts`, `tests/drafts.test.ts` – cover status change and orchestrator paths.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document commands/behavior.

## Functions
- `assertCampaignStatusTransition(current, next)` – enforce transition map with clear codes/messages.
- `updateCampaignStatus(client, id, next)` – apply status change with guardrails and return updated row.
- `generateDrafts(...)` (update) – orchestrate AI stub calls over segment members, support dry-run/fail-fast, update statuses.

## Tests
- `campaigns.rejects_invalid_status_transition` – invalid moves throw error code.
- `cli.campaign_status_command_wires_flags` – CLI passes status change to handler.
- `drafts.orchestrator_generates_and_updates_statuses` – drafts created; campaign/drafts statuses updated.
- `drafts.dry_run_creates_no_drafts` – dry-run skips insert; returns summary.
- `drafts.fail_fast_aborts_on_error` – fail-fast stops on first send error.
