# 2025-12-01 – Web UI Exposure Plan for W0.v3, W1.v2, AN.v2

> Timestamp (UTC): 2025-12-01T12:25:33Z
> Goal: Expose the already-built W0.v3/W1.v2/AN.v2 functionality in the web adapter/UI, add a SIM "coming soon" stub, and keep parity with CLI behaviour. No legacy fallbacks unless explicitly required.

## Overview
- Add web API routes + apiClient wiring for segments/snapshots/enrichment, ICP/hypothesis CRUD, coach-aware draft generation, analytics summaries/optimize, prompt registry, and a SIM stub.
- Update web UI pages to use the spine (segments + finalized snapshots), surface enrichment status, allow ICP/hypothesis selection + coach-driven drafts, and render AN.v2 analytics (ICP/hypothesis/segment/version/role/pattern/user_edited + prompt registry/suggestions).
- Keep SIM as Option 2: create a job and return a clear "coming soon" status; no behaviour beyond stub.

## Scope
- Implement only the endpoints and UI needed for W0.v3/W1.v2/AN.v2 parity.
- Enforce finalized snapshot before draft gen/enrichment; no legacy sync paths unless blocking.
- No new schema or prompt changes.

## Files to Touch
- `src/web/server.ts` – add routes for segments/snapshot/enrich/ICP/hyp/drafts/analytics/prompt-registry/SIM stub; enforce snapshot guard; propagate metadata.
- `web/src/apiClient.ts` – new client calls for segments, snapshots, enrichment, ICP/hyp CRUD, analytics summary/optimize, prompt registry, SIM stub.
- `web/src/pages/WorkflowZeroPage.tsx` – segment picker/snapshot/enrich status; segment-aware draft generation; Smartlead preview using segment members.
- `web/src/pages/IcpDiscoveryPage.tsx` – real ICP/hypothesis list/create flows and selection for draft generation.
- `web/src/pages/SimPage.tsx` – call SIM stub endpoint, show job id and "coming soon" state.
- `web/src/pages/EventsPage.tsx` (or new Analytics page) – render AN.v2 groupings and prompt registry/optimize suggestions.
- `web/src/App.tsx` – add navigation/sections for analytics if needed.
- Tests: `web/src/App.test.tsx` or new component tests for API wiring and guards; `web/src/apiClient.test.ts` for new endpoints.

## Planned Functions (1–3 sentences each)
- `listSegments`/`snapshotSegment`/`enqueueEnrichment`/`getEnrichmentStatus` (apiClient + server routes): fetch finalized segments, create snapshot, queue/run enrichment, and return latest job status.
- `listIcpProfiles`/`listIcpHypotheses`/`createIcpProfile`/`createIcpHypothesis` (apiClient + server routes): CRUD helpers to populate ICP/hypothesis selectors and attach to segments.
- `generateDraftsWithIcp` (server route wrapping `generateDrafts`): enforce snapshot, accept ICP/HYP ids, and persist metadata (draft_pattern, coach_prompt_id, user_edited=false).
- `getAnalyticsSummary`/`getAnalyticsOptimize`/`listPromptRegistry` (apiClient + server routes): expose AN.v2 groupings and prompt registry/optimization suggestions for UI tables.
- `createSimJobStub` (server route + apiClient): create `sim` job via stub and return `{ status: 'coming_soon', jobId }`.

## Planned Tests (5–10 words each)
- `api_client_segments_and_snapshot_round_trip` – lists segments, snapshots finalize, returns version.
- `api_client_enrichment_enqueue_and_status` – queues enrich job and surfaces latest status.
- `api_client_icp_crud_and_hypothesis_link` – creates profile/hypothesis and fetches lists.
- `api_client_analytics_summary_groupings` – returns grouped metrics by icp/segment/pattern.
- `api_client_sim_stub_returns_coming_soon` – SIM call yields stub status/job id.
- `workflow0_requires_finalized_snapshot_before_drafts` – UI blocks draft gen without finalized segment.
- `workflow0_shows_enrichment_status_badge` – UI renders last enrich job state.
- `icp_page_creates_and_selects_profile_hypothesis` – UI flow creates/selects ICP/HYP for drafts.
- `analytics_page_renders_grouped_tables_and_prompt_registry` – UI displays AN.v2 tables and registry.
- `sim_page_calls_stub_and_shows_job_id` – UI shows stub response and coming-soon banner.

## Tasks
- To Do:
  - Run a quick FK/view sanity check after wiring analytics (reuse `email_event_fks_are_present_for_recent_inserts` pattern from release hardening doc); ensure migrations already in place are assumed, not altered.
- Completed:
  - Implemented web adapter routes for segments (list/snapshot), enrichment (enqueue/status), ICP/HYP CRUD, analytics summary/optimize, prompt registry, and SIM stub with snapshot guard.
  - Wired apiClient to new endpoints (segments, enrichment, ICP/HYP, analytics, prompt registry, SIM) with coverage.
  - Updated Workflow 0 UI for segment selection, snapshot enforcement, enrichment trigger/status, and gated draft/send; added helper tests.
  - Updated ICP page with profile/hypothesis list/create/select flows and helper tests.
  - Added ICP page draft generation using selected ICP/HYP + finalized segment/campaign (dry-run guarded).
  - Documented UI priorities and prompts in `docs/web_ui_requirements.md` (authoritative UI source).
  - Added Analytics UI (group-by ICP/segment/pattern, prompt registry, optimize suggestions) with helper test.
  - Updated SIM page to call stub endpoint and display job/status; added helper test.
  - Full suite passing: `pnpm test --watch=false` (205 tests).
