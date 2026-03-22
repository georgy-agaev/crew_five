# Session Plan – 2025-11-23 13:02:01

## Overview
Shift focus toward the remaining Phase 1 items: introduce basic SMTP send pipeline scaffolding with logging/throttle stubs and prepare campaign status for sending, while keeping validation/status surfaces stable. No legacy fallback work.

## Plan
- Add SMTP send scaffold (service + CLI) with stubbed provider interaction and throttle/log hooks (no real sending).
- Ensure campaign status transitions cover sending/paused/complete paths; keep a single map in `src/status.ts`.
- Add minimal telemetry/logging stubs around send/validation for future observability.
- Update docs (README, changelog, session log) to describe the send scaffold and status applicability.

## Files to Touch
- `src/services/emailOutbound.ts` (new) – send scaffold, logging/throttle stubs.
- `src/cli.ts` – add `email:send` command wiring to the scaffold.
- `src/status.ts` – confirm sending/paused transitions are accurate; reuse map.
- `tests/emailOutbound.test.ts`, `tests/cli.test.ts` – cover send scaffold and CLI wiring.
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document new command and status applicability.

## Functions
- `sendQueuedDrafts(smtpClient, options)` – iterate queued drafts, respect throttle stub, log send attempts (stub provider).
- `recordOutbound(...)` – create outbound records with provider ids (stubbed).
- `registerEmailSendCommand(program)` – CLI command to trigger send scaffold.

## Tests
- `emailOutbound.sends_and_logs_stubbed_messages` – ensures drafts are iterated and logged.
- `emailOutbound.respects_throttle_stub` – throttle option limits processed drafts.
- `cli.email_send_command_wires_handler` – CLI passes options to send scaffold.

## Outcomes
- Added SMTP send scaffold (`src/services/emailOutbound.ts`) with stubbed provider send, throttle, and outbound recording; CLI docs updated with `email:send`.
- Tests cover stub send + throttle (`tests/emailOutbound.test.ts`).
- Docs updated (README command list, changelog 0.1.10); roadmap remains aligned; tests green (`pnpm test`).
