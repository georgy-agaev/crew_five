# Session Plan – 2025-11-25 13:10:03

## Overview
Add trace logging for AI interactions and MCP calls to capture model/router metadata and timing. Keep scope to minimal tracing API and JSON logs; no UI.

## Tasks
- Completed: Add tracing service to start/finish traces with metadata (model, latency, status) and env caps.
- Completed: Instrument AI draft generation and Smartlead MCP calls to emit traces (env toggle).
- Completed: Add CLI flags (`--trace-file`) to enable tracing and write to JSONL.
- Completed: Update docs/changelog and session log.

## Files to Touch
- `src/services/tracing.ts` (new) – trace start/finish helpers.
- `src/services/aiClient.ts`, `src/integrations/smartleadMcp.ts` – emit traces.
- `src/cli.ts`, relevant commands – optional `--trace-file` flag.
- `tests/tracing.test.ts`, `tests/aiClient.test.ts`, `tests/smartleadMcp.test.ts` – trace emission.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `startTrace(context)` – create trace id and start time with context.
- `finishTrace(trace, result)` – compute latency, status, and return trace record.
- `emitTrace(record)` – write to console/file when enabled.

## Tests
- `tracing.records_model_and_latency` – trace includes model/latency/status.
- `aiClient.emits_trace_on_generate` – generateDraft emits trace when enabled.
- `smartleadMcp.emits_trace_on_call` – MCP calls emit trace when enabled.

## Status
- Tracing service added; AI and Smartlead MCP instrumented; env toggles/cap present.
- CLI `--trace-file` flag added on draft generate and Smartlead commands; docs/changelog to reflect tracing usage.

## Review Notes
- Instrumentation is minimal and clean. Consider including parent/child span IDs if we later nest CLI spans over AI/MCP spans.
- `TRACE_ENABLED`/`TRACE_FILE` toggles are set via CLI by mutating `process.env`; keep that contained to command scope to avoid leakage across invocations in long-lived processes.
- `TRACE_MAX` cap is enforced; if traces become noisy, consider a per-command flag to override cap and a short note in docs about default behaviors.
