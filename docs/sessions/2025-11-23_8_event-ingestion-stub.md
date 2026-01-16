# Session Plan – 2025-11-23 20:20:00

## Overview
Add an event ingestion stub to record provider events into `email_events` with minimal validation and logging. No legacy fallback work.

## Plan
- Implement an event ingest service that normalizes payloads, supports dry-run/validation-only, and writes to `email_events` with basic validation.
- Add dedupe guard (provider + provider_event_id hash) and idempotency key generation.
- Add a CLI stub (`event:ingest`) to invoke the service with JSON payloads; keep it local-only (no network) and support `--dry-run`.
- Document the stub behavior, validation errors, and dedupe/dry-run in README/changelog/session log.

## Files to Touch
- `src/services/emailEvents.ts` – ingest/normalize/insert/dedupe/dry-run logic.
- `src/cli.ts` (or new command module) – `event:ingest` wiring with `--payload/--dry-run`.
- `tests/emailEvents.test.ts`, `tests/cli.test.ts` – service/CLI coverage (validation, dedupe, dry-run).
- `README.md`, `CHANGELOG.md`, `docs/sessions/` – document stub, validation errors, dedupe/dry-run.

## Functions
- `ingestEmailEvent(client, payload, options)` – validate minimal fields, normalize event_type/outcome, dedupe by provider+event_id hash, dry-run supported, insert into `email_events`.
- `mapProviderEvent(payload)` – map provider fields to canonical shape with outcome normalization and occurred_at default.
- `eventIngestHandler(...)` – CLI handler to parse JSON, support dry-run, and print success/error.

## Tests
- `emailEvents.rejects_invalid_payload` – missing required fields fails.
- `emailEvents.maps_and_persists_events` – valid payload is normalized and inserted.
- `emailEvents.dedupes_on_provider_event_id` – duplicate provider_event_id skipped.
- `emailEvents.dry_run_does_not_insert` – dry-run returns success but no insert.
- `cli.event_ingest_accepts_json_payload` – CLI calls handler with parsed JSON and dry-run.

## Outcomes
- Added `src/services/emailEvents.ts` with validation, normalization, dedupe on provider_event_id, and dry-run support.
- `event:ingest` CLI stub added (JSON payload, dry-run); wiring covered in tests.
- Tests for validation/dedupe/dry-run added; full suite green.
- Docs updated (README command, changelog 0.1.14) and session logged.
