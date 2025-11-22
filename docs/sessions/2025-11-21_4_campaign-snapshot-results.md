# Session Log – 2025-11-21 (Campaign Snapshot Enforcement)

## Tasks
1. Add `segments.version` column/migration and expose helpers to update/resuse versions.
2. Build `snapshotExists` + `ensureSegmentSnapshot` workflow that refreshes or reuses snapshots and wire it into CLI/handlers.
3. Update CLI/documentation/tests to cover `segment:snapshot`, `campaign:create --snapshot-mode/--bump-segment-version`, and persist snapshot metadata in campaigns.

## Outcomes
- Added Supabase migration for `segments.version` and pushed it to the remote DB.
- Created `src/services/segmentSnapshotWorkflow.ts` (parse filters, fetch contacts, snapshot enforcement) plus updated `segmentSnapshotHandler`, `campaignCreateHandler`, and CLI to support new flags.
- Campaign metadata now records snapshot version/count; `ensureSegmentSnapshot` ensures campaigns can only launch against deterministic contact sets.
- Added/updated Vitest suites (workflow, handlers, CLI) and documentation (README, CHANGELOG); total tests: 23 passing.

## Next Steps
- Integrate automatic snapshot refresh when campaigns are edited in the future UI.
- Enhance filter language (AND/OR, numeric ops) and add e2e tests verifying CLI→Supabase snapshots.
