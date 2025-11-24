# Session Plan – 2025-11-24 12:34:38

## Overview
Small Smartlead MCP ingest polish: add capped `Retry-After` handling with override, avoid mutating
response objects for error caching, and add a guarded fallback flag for `occurred_at` when missing
(`--assume-now-occurred-at`). No legacy fallback; keep ingest-only scope.

## Tasks
- Completed: Add `Retry-After` handling in MCP fetch retries with cap (default 5s) and `--retry-after-cap-ms` override.
- Completed: Replace response `_cachedError` mutation with local caching keyed by URL/attempt.
- Completed: Add `--assume-now-occurred-at` flag (default off) to fill `occurred_at` when missing; error message gives guidance when disabled.
- Completed: Update changelog/session doc after changes.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – Retry-After support with cap/override, local error cache, clearer occurred_at handling (with optional fallback).
- `src/commands/smartleadEventsPull.ts`, `src/cli.ts` – wire `--retry-after-cap-ms` and `--assume-now-occurred-at`.
- `tests/smartleadMcp.test.ts`, `tests/cli.test.ts` – cover Retry-After, error cache, fallback flag path.
- `CHANGELOG.md`, this session doc.

## Functions
- `requestWithRetry(...)` – respect `Retry-After` (429/5xx) up to cap (default 5s, override via option) before retrying.
- `buildResponseError(response, url)` – cache per-request without mutating response; reuse parsed body.
- `normalizeEvent(event, opts)` – error when missing `occurred_at` unless fallback flag fills with now; message gives guidance.

## Tests
- `smartleadMcp.respects_retry_after_on_5xx` – waits per header (capped/override) before retry.
- `smartleadMcp.error_cached_without_response_mutation` – error builder doesn’t rely on response mutation.
- `smartleadMcp.missing_occurred_at_flag_fills_now_or_errors` – flag fills timestamp; otherwise error mentions supplying occurred_at.
- `cli.smartlead_events_pull_wires_retry_cap_and_assume_now` – CLI passes cap and fallback flag.

## Outcomes
- Retry-After honored (429/5xx) with cap/override; no response mutation for error caching.
- CLI wires `--retry-after-cap-ms` and `--assume-now-occurred-at` to MCP client; validation stays strict.
- Missing `occurred_at` now surfaces guidance, or fills with now when flag is set.
- Tests cover retry cap, error caching, fallback flag, and CLI wiring; changelog bumped (0.1.21).

## Review Notes
- `assume-now` uses `new Date()` per event; consider computing once per pull for consistency if Smartlead ever batches with missing timestamps.
- `parseRetryAfter` logic is clean; keep cap defaults near the function or configurable to avoid magic numbers spreading.
- Error builder is non-mutating now; good. If we want richer errors, we could include the request URL in the message for campaigns too (currently only events) or pass a hint for provider-side fixes when occurred_at is absent.
