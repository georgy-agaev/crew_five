# Session Plan – 2025-11-24 11:04:03

## Overview
Harden the Smartlead MCP ingest-first flow: add pagination/filters (`since`, `limit`), tighten
idempotency and error handling, and keep outputs single-summary with dry-run parity. No legacy
fallback. Focus only on the ingest path (no outbound send yet).

## Tasks
- Completed: Add `since`/`limit` options to Smartlead MCP event pulls and pass through CLI.
- Completed: Ensure pulled events enforce `provider_event_id` and build idempotency hash when missing.
- Completed: Add structured error handling and single summary logging for list/pull commands.
- Completed: Update docs (README, Setup_smartlead_mcp) and changelog; log session outcomes.

## Review Notes
- Idempotency fallback currently uses a random UUID when `provider_event_id` is missing, which is not stable across pulls. Consider a deterministic hash (provider + occurred_at + outbound_id + type) to dedupe repeat events.
- MCP fetch errors omit response body/status text; enrich error messages for faster debugging.
- CLI `--since`/`--limit` accept any strings; add lightweight ISO/number validation to fail fast on bad input.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – add query params for `since`/`limit`, enforce provider_event_id/idempotency hash.
- `src/commands/smartleadEventsPull.ts`, `src/cli.ts` – wire options and summaries.
- `tests/smartleadMcp.test.ts`, `tests/cli.test.ts` – cover filters, idempotency, dry-run/summaries.
- `README.md`, `docs/Setup_smartlead_mcp.md`, `CHANGELOG.md`, this session doc.

## Functions
- `buildSmartleadMcpClient(config)` – add support for `since`/`limit` query params and idempotent event normalization.
- `pullEvents(client, options)` – fetch events with filters, normalize, require provider_event_id/idempotency hash, dry-run aware.
- `smartleadEventsPullCommand(args)` – accept `since`/`limit`, call ingest with idempotent payloads, emit single summary.

## Tests
- `smartleadMcp.pull_events_supports_since_and_limit` – builds URL with query params, honors dry-run.
- `smartleadMcp.normalizes_idempotent_events` – enforces provider_event_id/idempotency hash presence.
- `cli.smartlead_events_pull_passes_filters_and_summarizes` – CLI forwards filters, prints single summary.
