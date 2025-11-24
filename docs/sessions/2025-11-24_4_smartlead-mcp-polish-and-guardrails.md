# Session Plan – 2025-11-24 12:15:59

## Overview
Polish Smartlead MCP ingest by addressing review nits: use a better fallback for occurred_at in the
idempotency hash, avoid double-reading error bodies, and clarify ISO `--since` requirements in docs.
No legacy fallback; ingest-only scope.

## Tasks
- Completed: Require `occurred_at` (reject if missing) to keep idempotent hash predictable.
- Completed: Cache response body/JSON once when building errors to avoid double reads; emit structured and snippet.
- Completed: Clarify in docs that `--since` must be Zulu ISO (no offsets).
- Completed: Add tests for 4xx (no retry) and 5xx with retry to ensure single body read and error surfacing.
- Completed: Update changelog/session doc after changes.

## Outcomes
- `normalizeEvent` now rejects missing `occurred_at`; id hash stays deterministic.
- Error builder caches body/JSON and is reused across retries; tests cover 4xx/5xx single body read.
- Docs clarify Zulu-only `--since`; changelog updated (0.1.20).

## Review Notes
- Consider clarifying the `occurred_at` error with guidance (provider must supply it, or we fall back to pull timestamp if we choose resilience later).
- Error caching uses a `_cachedError` mutation on the response; could switch to a local cache keyed by URL/attempt to avoid mutating responses.
- Retry remains fixed 50ms; optional improvement is to respect `Retry-After` when present to play nicer with rate limits.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – adjust hash fallback occurred_at, cache body in error builder.
- `README.md`, `docs/Setup_smartlead_mcp.md` – note Zulu ISO requirement for `--since`.
- `CHANGELOG.md`, this session doc.

## Functions
- `normalizeEvent(event)` – default occurred_at to pulled timestamp when absent before hashing.
- `buildResponseError(response, url)` – read body once and reuse; include status/body snippet.

## Tests
- `smartleadMcp.hash_uses_pulled_timestamp_when_missing` – hash stable when occurred_at absent.
- `smartleadMcp.error_body_read_once` – error builder caches body (spy text call count).
- `docs mention Z-only since` – checklist to confirm docs updated.
