# Session Plan – 2025-11-25 13:10:03

## Overview
Add lightweight interaction telemetry for CLI actions (send, enrich, judge) with opt-in hooks and no PII. Keep scope to JSON summary logs; no backend store yet.

## Tasks
- Completed: Add telemetry service to emit JSON events for key actions with PII validation.
- Completed: Instrument Smartlead commands with opt-in telemetry hooks; `--telemetry` flag added.
- Completed: Update docs/changelog and session log to document telemetry flag usage.

## Files to Touch
- `src/services/telemetry.ts` (new) – emit/warn helpers.
- `src/cli.ts`, commands – `--telemetry` flag and calls.
- `tests/telemetry.test.ts`, `tests/cli.test.ts` – verify emission on opt-in.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `emitTelemetry(event, payload, options)` – emit JSON event when enabled; no PII.
- `validateTelemetryContext(payload)` – basic validation, warn on PII fields.

## Tests
- `telemetry.emits_on_cli_actions` – events emitted when flag set.
- `telemetry.rejects_invalid_payload` – validation warns/blocks on disallowed fields.

## Status
- Telemetry service added; Smartlead CLI commands have `--telemetry` flag; validation present; tests passing.
- Docs/changelog updated with telemetry flag and usage guidance.

## Review Notes
- Telemetry stays opt-in and JSON-only—good. The PII guard is simple; if we expand events, consider a small schema per event type to reduce false positives.
- CLI mutates `process.env` for tracing; telemetry flag does not—keep it that way to avoid cross-run leakage.
- If you add more sinks later, reuse the single emit helper to stay DRY and avoid per-command logging code.
