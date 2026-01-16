# Session Plan – 2025-11-24 12:00:38

## Overview
Tighten Smartlead MCP ingest: make idempotency deterministic when provider IDs are missing, improve
error surfacing from MCP fetches, and validate CLI inputs for `since`/`limit`. No legacy fallback;
keep ingest-only scope.

## Tasks
- Completed: Replace random UUID fallback with deterministic hash for events lacking `provider_event_id`.
- Completed: Enrich MCP fetch errors with status + body excerpt; keep single-summary outputs.
- Completed: Validate/parse `--since` (ISO) and `--limit` (number) in CLI before calling MCP; fail fast.
- Completed: Update docs/changelog and session log after implementation.

## Outcomes
- Deterministic idempotency hash now derived from provider + occurred_at + outbound_id + event_type + raw payload when provider_event_id is absent.
- MCP fetch errors include status/statusText and body snippet; events pull retries once on 5xx.
- CLI validates ISO `--since` and positive integer `--limit` (clamped to 500); still summary-only output.

## Review Notes
- Hash fallback is good; consider using pulled timestamp when occurred_at is missing to reduce collisions.
- Error handling reads response twice on retry failure; caching body would avoid double parsing.
- Retry is fixed (50ms, once); acceptable now, but jitter/Retry-After support could help if MCP rate-limits.
- ISO regex requires Z (no offsets); ensure this is intentional or note it in docs.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – deterministic idempotency, richer error messages.
- `src/commands/smartleadEventsPull.ts`, `src/cli.ts` – input validation for `since`/`limit`.
- `tests/smartleadMcp.test.ts`, `tests/cli.test.ts` – cover hash fallback, error surfacing, validation failures.
- `README.md`, `docs/Setup_smartlead_mcp.md`, `CHANGELOG.md`, this session doc.

## Functions
- `normalizeEvent(event)` – build stable `provider_event_id` via deterministic hash when missing; attach payload.
- `pullEvents(options)` – fetch with filters, throw enriched errors including status/body when non-OK.
- `smartleadEventsPullCommand(args)` – parse/validate `since` ISO and `limit` number; pass filters; emit summary.

## Tests
- `smartleadMcp.idempotent_hash_for_missing_provider_id` – missing IDs get deterministic hash.
- `smartleadMcp.fetch_error_includes_status_and_body` – non-OK responses throw enriched error text.
- `cli.smartlead_events_pull_rejects_bad_since_or_limit` – CLI fails fast on invalid args.
