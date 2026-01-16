# 2025-12-05 – Exa Discovery Phase 2: Promotion & UI Plan

> Timestamp (UTC): 2025-12-05T00:00:00Z  
> Goal: turn Exa discovery runs into a usable ICP → candidates → segments flow by adding candidate promotion into `companies` / `segment_members` and wiring a minimal “Run discovery” + “Review candidates” experience in the Web UI and CLI, without introducing new legacy modes.

## Overview
We’ll build the missing pieces between discovery runs and downstream workflows: a small promotion service that moves approved candidates into `companies` and `segment_members`, and UI/CLI hooks that let users trigger Exa discovery, then promote selected candidates into a segment. We will keep all work async/job-based and avoid adding any synchronous/legacy paths.

## Scope (files to touch)
- **Services**
  - `src/services/icpDiscovery.ts` – add promotion helpers that take candidate ids, create/merge `companies`, and insert `segment_members` tied to a chosen segment.
  - `src/services/segments.ts` / `src/services/segmentSnapshotWorkflow.ts` – ensure promotion respects existing segment/snapshot semantics (no bypass of snapshot requirements).
- **CLI**
  - `src/commands/icpDiscover.ts` – optionally add a `--promote` flag that, when provided with a segment id and candidate filters, calls the promotion service after discovery completes.
  - `src/cli.ts` – wire the new flags and keep `icp:discover` output JSON-only for scripting.
- **Web adapter & UI**
  - `src/web/server.ts` – add a `POST /api/icp/discovery/promote` endpoint that accepts `{ runId, candidateIds[], segmentId }` and calls the promotion helper.
  - `web/src/apiClient.ts` – add `promoteIcpDiscoveryCandidates` helper mirroring this endpoint.
  - `web/src/pages/IcpDiscoveryPage.tsx` – add a minimal promotion control (e.g. select a segment, click “Promote approved candidates”) that calls the API and surfaces success/errors.
- **Docs**
  - `docs/Database_Description.md` – note how promoted candidates flow into `companies` and `segment_members`, and how they connect to ICP profiles/hypotheses.
  - `CHANGELOG.md` – mention Exa discovery promotion capabilities and UI updates.

## Functions (1–3 sentences)
- `promoteIcpDiscoveryCandidatesToSegment(supabase, { runId, candidateIds, segmentId })` (`src/services/icpDiscovery.ts`)  
  Looks up candidate rows by id, creates or links `companies` based on domain, and inserts `segment_members` for the chosen segment, tagging them with relevant ICP ids. It should be idempotent for the same candidate/segment pair.

- `icpDiscoverAndPromoteCommand(client, options)` (`src/commands/icpDiscover.ts`)  
  Extends the existing CLI handler to optionally trigger discovery and then promotion in one go, returning a JSON payload that includes `{ jobId, runId, promotedCount }` when promotion is requested.

- `promoteIcpDiscoveryCandidates` (`web/src/apiClient.ts`)  
  Posts `{ runId, candidateIds, segmentId }` to the promotion endpoint and returns a summary `{ promotedCount }`, raising an error on failure so the UI can show an alert.

- `handlePromoteCandidates` (`web/src/pages/IcpDiscoveryPage.tsx`)  
  Reads the currently approved candidate ids and selected segment from UI state, calls `promoteIcpDiscoveryCandidates`, and updates a small status badge indicating how many companies were promoted.

## Tests (name → behaviour in 5–10 words)
- `icp_discovery_promote_creates_companies_and_segment_members`  
  Promotion inserts companies and segment_members from candidates.

- `icp_discovery_promote_is_idempotent_for_same_candidate_segment`  
  Running promotion twice does not duplicate rows.

- `icp_discover_cli_with_promote_returns_promoted_count`  
  CLI outputs `{ jobId, runId, promotedCount }` JSON.

- `icp_discovery_api_promote_rejects_missing_run_or_segment`  
  HTTP endpoint validates required runId/segmentId inputs.

- `web_icp_discovery_page_calls_promote_api_for_approved_ids`  
  UI sends only approved candidate ids to promotion API.

- `web_icp_discovery_page_shows_promotion_success_and_errors`  
  Displays success badge or error Alert appropriately.

## Completed vs To Do
- **Completed (previous sessions)**  
  - Exa discovery runs, candidate ingestion, and listing are implemented with job-backed orchestration and Web/CLI wiring.  
  - UI can load and review candidates for a given `runId` and approve/discard them in the pre-import review table.
- **Completed (this session)**  
  - Implemented promotion helper `promoteIcpDiscoveryCandidatesToSegment` and wired it into the CLI (`icp:discover --promote --segment-id ... --candidate-ids ...`) and web adapter (`POST /api/icp/discovery/promote`), moving approved Exa candidates into `companies` / `segment_members` with ICP tags.  
  - Added a minimal promotion control to `IcpDiscoveryPage` that uses the existing approval state to collect approved candidate ids, calls the promotion API, and shows a small success summary in the UI.  
  - Updated `docs/Database_Description.md` to describe how discovery candidates can be promoted into `companies` / `segment_members` for segments, and recorded these changes in `CHANGELOG.md` under version `0.1.63`.  
- **To Do (future phases)**  
  - Extend promotion telemetry and UI affordances (e.g., surfaced promoted company list, richer error handling) and document multi-run promotion workflows once additional UX iterations are planned.
