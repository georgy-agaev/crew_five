# Session Plan – 2025-11-23 15:17:35

## Overview
Finalize SMTP send logging and summaries: emit structured per-batch results, add dry-run and summary format options, and keep scope narrow (no provider changes).

## Plan
- Emit structured summary (sent/failed/skipped) with batch_id/timestamp; support `--dry-run` to skip sends.
- Add `--summary-format json|text` (default json) and optional per-draft debug logs behind `--log-json`/`--verbose`.
- Add telemetry/log stub hook for send_batch events; keep stub provider.
- Clarify retry/throttle behavior and summary options in README/CHANGELOG; add troubleshooting note for failed sends.

## Files to Touch
- `src/cli.ts` – ensure `email:send` prints/returns summary in JSON when `--log-json`.
- `src/services/emailOutbound.ts` – batch_id/timestamp, dry-run, telemetry/log hooks.
- `tests/cli.test.ts` – cover summary output for `email:send`.
- `tests/emailOutbound.test.ts` – summary reflects retry/throttle; dry-run skips sends.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document summary/retry/throttle behavior.

## Functions
- `sendQueuedDrafts(...)` – return summary with batch_id/timestamp; honor dry-run; emit telemetry/log hook.
- `registerEmailSendCommand` – print summary per format and respect log-json/verbose.

## Tests
- `cli.email_send_outputs_summary_formats` – CLI prints JSON/text summary per format.
- `emailOutbound.summary_reflects_retry_throttle_and_dry_run` – sent/failed/skipped match behavior.
