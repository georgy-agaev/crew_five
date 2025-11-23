# Session Plan – 2025-11-23 22:25:46

## Overview
Fix campaign status CLI wiring to use a dedicated handler with transition guards, and add a simple draft orchestration flow (with dry-run/fail-fast). No legacy fallback work.

## Plan
- Wire `campaign:status` to a dedicated handler that enforces the status transition map and returns clear errors; allow `--dry-run` and exit non-zero on invalid transitions.
- Add a draft orchestrator that iterates segment members, calls the AI stub, inserts drafts, supports dry-run/fail-fast with summary, and updates campaign/draft statuses with a batch limit.
- Update docs/changelog/session log to reflect the status command and orchestrator behavior (flags: dry-run, fail-fast, limit).

## Files to Touch
- `src/commands/campaignStatus.ts`, `src/cli.ts` – status command wiring/guards, optional dry-run.
- `src/services/drafts.ts`, `src/commands/draftGenerate.ts` – orchestrator + dry-run/fail-fast/limit.
- `tests/campaigns.test.ts`, `tests/cli.test.ts`, `tests/drafts.test.ts` – cover status CLI and orchestrator.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document new behaviors.

## Functions
- `campaignStatusHandler(...)` – fetch current status, validate transition, update campaign.
- `generateDrafts(...)` (update) – orchestrate over segment members, support dry-run/fail-fast/limit, update statuses.

## Tests
- `campaigns.status_cli_rejects_invalid_transition` – invalid moves throw error/code.
- `cli.campaign_status_command_passes_status` – CLI wires status and returns clear errors.
- `drafts.orchestrator_generates_and_updates_statuses` – drafts created; statuses updated.
- `drafts.dry_run_skips_inserts` – dry-run returns summary without inserts.
- `drafts.fail_fast_aborts_on_error` – fail-fast stops on first AI error.

## Outcomes
- Campaign status CLI now uses guarded handler with dry-run; invalid transitions exit non-zero.
- Draft orchestrator supports dry-run/fail-fast/limit with summary; tests updated.
- Docs/changelog updated to reflect new flags/behaviors.
