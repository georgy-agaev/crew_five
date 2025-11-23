# Session Plan – 2025-11-23 14:38:01

## Overview
Harden the SMTP send scaffold: add robust throttling, error handling, and logging for outbound sends while keeping scope tight and avoiding legacy fallback.

## Plan
- Add idempotency/duplicate guards (set drafts to `sending` before send, revert on failure) and a batch lock/id to avoid double-send.
- Implement time-based throttle (per minute) with skip/log on over-limit; include summary of sent/failed/skipped.
- Add structured error handling/logging with a one-time retry stub for transient errors; log attempts.
- Update CLI to print summary (sent/failed/skipped) and support `--log-json`; document behavior in README/changelog/session.

## Files to Touch
- `src/services/emailOutbound.ts` – idempotency (status update), throttle window, retry/log summary.
- `src/cli.ts` – send summary output and `--log-json`.
- `tests/emailOutbound.test.ts`, `tests/cli.test.ts` – throttle, retry/error logging, summary.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document send scaffold behavior.

## Functions
- `sendQueuedDrafts(...)` – enforce throttle window, idempotent status updates, retry once on error, and return summary.

## Tests
- `emailOutbound.respects_throttle_and_skips_excess` – doesn’t send beyond throttle limit.
- `emailOutbound.logs_send_errors_and_continues` – error path logged without breaking batch.
- `cli.email_send_options_pass_throttle_and_log_behavior` – CLI wires throttle/log options.

## Outcomes
- Hardened SMTP send scaffold: throttle window enforced, drafts marked sending to avoid duplicates,
  retry-once stub for errors, summary logging (`src/services/emailOutbound.ts`).
- CLI supports `email:send` with stub provider; summary logged when `logJson` enabled.
- Tests cover throttle/skip, retry logging, and CLI wiring (`tests/emailOutbound.test.ts`, `tests/cli.test.ts`); full suite green (`pnpm test`).
- Docs updated (README send command, changelog 0.1.10); roadmap/session log updated.
