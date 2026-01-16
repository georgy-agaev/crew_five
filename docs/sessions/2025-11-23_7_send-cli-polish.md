# Session Plan – 2025-11-23 19:32:17

## Overview
Polish the email send CLI/logging to avoid double-logging summaries, add dry-run assurance, and keep scope tight. No legacy fallback work.

## Plan
- Add `--fail-on-error` and optional `--batch-id` override; keep logging single-source.
- Ensure summary logging happens once (prefer handler hook/callback) and clarify log-json behavior.
- Add dry-run tests to confirm no sends occur and summary reflects skips; add text format assertion.
- Update README/CHANGELOG/session log to reflect single-log, dry-run, batch-id, and fail-on-error behavior.

## Files to Touch
- `src/cli-email-send.ts` / `src/services/emailOutbound.ts` – adjust summary logging responsibilities.
- `tests/cli.test.ts`, `tests/emailOutbound.test.ts` – add dry-run and summary format assertions.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document behavior.

## Functions
- `sendQueuedDrafts(...)` – return summary with batch_id, honor dry-run/fail-on-error, and accept an optional logger callback.
- `emailSendHandler(...)` – emit summary once per request according to format/log flags; handle fail-on-error exit code.

## Tests
- `emailOutbound.dry_run_skips_send_and_summarizes` – no send calls; summary skipped count matches.
- `emailOutbound.fail_on_error_sets_exit_or_flag` – fail-on-error toggles exit handling/summary.
- `cli.email_send_json_summary_no_duplicates` – JSON summary printed once when requested; text format single line.

## Outcomes
- Send scaffold now supports batch_id override, logger callback, fail-on-error, and dry-run; summary logging centralized.
- CLI send command exposes batch-id/fail-on-error; tests cover dry-run and summary formats; docs/changelog updated.
