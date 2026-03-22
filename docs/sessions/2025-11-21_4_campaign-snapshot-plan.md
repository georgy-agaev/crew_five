# Session Plan – 2025-11-21 (Campaign Snapshot Enforcement)

## Overview
Now that segments can be snapshotted manually, we need campaigns to rely on deterministic contact sets. The next session will introduce snapshot enforcement: on `campaign:create`, ensure the specified segment version has an up-to-date snapshot (optionally triggering one), persist the snapshot metadata, and offer CLI ergonomics for operators to refresh before drafting.

## Tasks
1. **Segment Version & Snapshot Resolver**
   - Add helper to fetch a segment and determine the latest version, incrementing if `--bump-version` is passed.
   - Provide a service that checks whether `segment_members` exist for the desired version; if not (or if `--force`), run `createSegmentSnapshot` inline.
2. **Campaign Creation Integration**
   - Update `campaignCreateHandler` to accept `--snapshot-mode (reuse|refresh)` flag.
   - Before inserting the campaign, resolve/refresh the snapshot and persist the snapshot’s version + counts in campaign metadata.
3. **Docs & Tests**
   - Expand README usage (new flags + workflow) and CHANGELOG/AGENTS.
   - Add Vitest suites covering the resolver, campaign handler integration, and CLI parsing.

## Files to Change
- `src/services/segments.ts` (segment version resolver, snapshot existence check).
- `src/services/segmentSnapshot.ts` (optional helper to query existing membership counts).
- `src/commands/campaignCreate.ts` & `src/cli.ts` (new options, wiring to resolver).
- `tests/*` for new helpers + handler/CLI behaviour.
- Docs: README, CHANGELOG, AGENTS, session log after completion.

## Functions
- `ensureSegmentSnapshot(client, segmentId, opts): Promise<{ version: number; count: number; }>` – loads segment, optionally bumps version, checks for existing `segment_members`, and triggers `createSegmentSnapshot` when required.
- `snapshotExists(client, segmentId, version): Promise<boolean>` – lightweight helper returning whether rows already exist for the target version.
- `campaignSnapshotWorkflow(...)` – orchestrates the overall flow used by `campaignCreateHandler`, returning the snapshot metadata for insertion into `campaigns`.

## Tests
- `snapshotExists_trueWhenMembershipPresent` – stub Supabase response with count.
- `ensureSegmentSnapshot_runsCreateWhenMissing` – expect `createSegmentSnapshot` invoked and metadata returned.
- `ensureSegmentSnapshot_skipsWhenReuseAllowed` – no snapshot call if `reuse` and data exists.
- `campaignCreateHandler_refreshesSnapshotWhenRequested` – CLI handler triggers workflow before inserting.
- `cli_campaignCreate_acceptsSnapshotMode` – CLI parsing passes `--snapshot-mode` to handler.

## Implementation Notes
- Only support two modes for now: `reuse` (default) and `refresh` forcing a new snapshot; fail fast if an unsupported mode is provided.
- Defer advanced filter operators/multi-tenant considerations until later; keep scope focused on verifying snapshot availability before campaign launch.
