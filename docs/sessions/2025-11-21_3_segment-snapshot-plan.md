# Session Plan – 2025-11-21 (Segment Snapshot + CLI Expansion)

## Overview
Implement the minimum slice needed to move from static “segment” definitions to actual contact snapshots that feed campaigns. We will build a Supabase-backed snapshot service plus a CLI command (`segment:snapshot`) that reads the saved filter definition, resolves contacts, and persists `segment_members` rows along with basic audit metadata. Documentation and tests will be updated so this flow is reproducible end-to-end.

## Tasks
1. **Segment Snapshot Service**
   - Translate stored `segments.filter_definition` into a deterministic query against `employees`/`companies` (start with simple equality + ilike support based on JSON fields; no legacy fallbacks).
   - Upsert rows into `segment_members` for the provided segment version, deleting stale entries first.
2. **CLI Command & Wiring**
   - Add `segment:snapshot` command that accepts `--segment-id` and optional `--segment-version` (default latest) and invokes the snapshot service.
   - Ensure CLI output/logging surfaces snapshot counts and errors.
3. **Docs & Tests**
   - Add Vitest coverage for snapshot service + CLI handler.
   - Update README/AGENTS/CHANGELOG/session log with new command usage and testing guidance.

## Files to Change
- `src/services/segments.ts` (add helper to fetch segment + parse filters).
- `src/services/segmentMembers.ts` (new service powering snapshot logic).
- `src/commands/segmentSnapshot.ts` (new CLI handler) and `src/cli.ts` registration.
- `tests/*.test.ts` (new suites for service + command).
- `README.md`, `AGENTS.md`, `CHANGELOG.md`, session log (this file) for instructions and release notes.

## Functions
- `resolveSegmentFilters(segment): SegmentFilterQuery` – parses `filter_definition` JSON into a normalized structure (supported operators: equals, ilike, contains arrays) to keep query building in one place.
- `fetchContactsForSegment(client, filterQuery): Promise<ContactRow[]>` – queries `employees` joined with `companies` based on resolved filters; returns light snapshot payloads.
- `createSegmentSnapshot(client, segment, contacts, options): Promise<SnapshotResult>` – deletes existing `segment_members` rows for the segment/version, inserts normalized `snapshot` payloads, and returns counts/metadata.
- `segmentSnapshotHandler(client, options): Promise<SnapshotResult>` – CLI-facing wrapper that loads the segment, builds filters, fetches contacts, calls `createSegmentSnapshot`, and returns stats for logging.

## Tests
- `resolveSegmentFilters_supportsEqualityAndIlike`: ensure filters translate to canonical query object.
- `fetchContactsForSegment_buildsSupabaseQuery`: mocked Supabase `from`/`select` interactions happen with expected criteria.
- `createSegmentSnapshot_replacesPreviousRows`: deletes old membership rows and inserts new ones in one call.
- `segmentSnapshotHandler_runsEndToEnd`: handler loads segment, invokes fetch + snapshot services, and returns counts.
- `cli_segmentSnapshot_route`: CLI wiring calls handler with parsed options.

## Notes
- No legacy fallbacks: if a filter operator is unsupported, fail fast with a helpful error.
- E2E focus: once snapshot command exists, future sessions can hook it into campaign creation/draft generation.
- Use existing Supabase mock patterns from other tests to stay DRY.
