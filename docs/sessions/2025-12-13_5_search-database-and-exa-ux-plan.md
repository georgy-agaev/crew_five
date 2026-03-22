# Session Plan – 2025-12-13 Search Database & Exa Web Search Wiring

> Timestamp (UTC): 2025-12-13T22:59:21Z  
> Goal: Make the Pipeline Segment step’s **Search Database** and **EXA Web Search** tiles actually drive users into live company lists and Exa discovery candidates, using the existing Workflow Zero and ICP Discovery pages, without adding new legacy fallbacks.

## Short Overview

- Wire **Search Database** so it leads from the Pipeline Segment step (with a selected segment) into a real company list view backed by `/api/companies`, reusing the existing `WorkflowZeroPage` instead of inventing a new surface.  
- Make **EXA Web Search** visibly do something: either show a clear error when discovery fails or, on success, surface status, a “Review candidates in ICP Discovery” CTA, and navigate into `IcpDiscoveryPage` where candidates auto-load for the latest run.  
- Keep changes narrow: edit the existing Pipeline/Router/ICP Discovery files, reuse helpers (`persistLatestDiscoveryRun`, `resolveViewFromLocation`), and extend tests so we can safely iterate on the UX.

## Current Behaviour & Gaps

- **Search Database tile (Segment step)**  
  - `PipelineWorkspaceWithSidebar.tsx` renders the tile and wires it to `handleSearchDatabaseClick`.  
  - `handleSearchDatabaseClick` currently just opens the AI Chat modal with a canned “help me find segments in the database” prompt; it does not call `/api/companies`, does not navigate to `WorkflowZeroPage`, and does not show any company list.

- **EXA Web Search tile (Segment step)**  
  - The tile calls `handleRunDiscovery`, which:  
    - Validates ICP selection.  
    - Calls `triggerIcpDiscovery`.  
    - Persists `{ runId, icpProfileId, icpHypothesisId }` via `persistLatestDiscoveryRun`.  
    - Sets a text `discoveryStatus`.  
  - In the live UI we observed:  
    - Clicking EXA Web Search shows no status text, no CTA, and no error.  
    - Any failure from `/api/icp/discovery/trigger` is written to `aiError`, which is only rendered inside the AI Chat modal (not shown when starting discovery from the tile).  
    - The CTA/Deep-link helpers (`hasPersistedDiscoveryRun`, `openIcpDiscoveryForLatestRun`) are present but not clearly surfaced to the user.

- **Workflow Zero page (existing DB-backed company view)**  
  - `web/src/pages/WorkflowZeroPage.tsx` already wires:  
    - `fetchSegments`, `fetchCompanies`, and `fetchContacts` to render companies/contacts for a selected segment.  
    - `snapshotSegment`, `enqueueSegmentEnrichment`, `triggerDraftGenerate`, etc.  
  - `App.tsx` does not expose this page; it only chooses between Pipeline and `IcpDiscoveryPage` based on `view=pipeline|icp-discovery`.  
  - There is no present way in the UI to navigate into `WorkflowZeroPage` from the Pipeline.

## Files to Change

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`  
  - Wire **Search Database** to a real DB-backed view (deep-link into Workflow Zero).  
  - Make **EXA Web Search** surface success and error states and expose the “Review candidates” deep-link CTA more clearly.

- `web/src/App.tsx`  
  - Extend `resolveViewFromLocation` to support a `workflow-zero` (or `workflow0`) view.  
  - Render `WorkflowZeroPage` when `view=workflow-zero` and pass through any relevant props (e.g., `smartleadReady`).

- `web/src/pages/WorkflowZeroPage.tsx`  
  - Optionally read a `segmentId` query parameter (e.g. `?segmentId=seg-1`) so Workflow Zero can auto-select the segment that the user had in the Pipeline.  
  - Keep defaults for existing behaviour when no query param is present.

- `web/src/pages/IcpDiscoveryPage.tsx`  
  - Ensure auto-load behaviour works when launched via deep-link from the EXA Web Search CTA (we already hydrate from `sessionStorage` and `runId`; we may add a small guard to avoid double loads).

- Tests  
  - `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`  
  - `web/src/App.test.tsx`  
  - `web/src/pages/WorkflowZeroPage.test.ts`  
  - `web/src/pages/IcpDiscoveryPage.test.tsx`

## Implementation Plan – Search Database Wiring

### Behaviour

- Clicking **Search Database** in the Segment step should:
  - Require a selected segment (show a small, local error near the tile if not).  
  - Navigate to `WorkflowZeroPage` with enough context (e.g. `?view=workflow-zero&segmentId=<id>`).  
  - On arrival, Workflow Zero should auto-select the given segment and show the live company list for it (via the existing `fetchCompanies({ segment })` logic).

### Functions to Implement / Extend

- `buildWorkflowZeroLinkParams(meta)` – `PipelineWorkspaceWithSidebar.tsx`  
  - Accepts `{ segmentId }` and returns a small object `{ view: 'workflow-zero', segmentId }` suitable for URLSearchParams (mirrors `buildDiscoveryLinkParams`).

- `openWorkflowZeroForSegment(segmentId: string)` – `PipelineWorkspaceWithSidebar.tsx`  
  - Builds a query string from `buildWorkflowZeroLinkParams` and calls `window.location.assign` to navigate to the Workflow Zero view for the current segment.

- `handleSearchDatabaseClick()` – `PipelineWorkspaceWithSidebar.tsx` (existing)  
  - Update to:  
    - If no `completed.segment`, set a clear local error (e.g. `setAiError` or a new `segmentSearchError`) near the Search Database tile and return.  
    - Otherwise call `openWorkflowZeroForSegment(completed.segment.id)` rather than opening the AI Chat modal.

- `resolveViewFromLocation(loc)` – `web/src/App.tsx` (existing)  
  - Extend the union return type to `'pipeline' | 'icp-discovery' | 'workflow-zero'`.  
  - Parse `view=workflow-zero` from the query string and return `'workflow-zero'` if present.

- `App()` – `web/src/App.tsx`  
  - Add a branch: when `view === 'workflow-zero'`, render `<WorkflowZeroPage smartleadReady={smartleadReady} />`; otherwise use existing branches.

- `WorkflowZeroPage` – `web/src/pages/WorkflowZeroPage.tsx`  
  - On mount, read `window.location.search` (or accept an optional `initialSegmentId` prop) and, if a `segmentId` is present and matches a loaded segment, set `selectedSegment` to that id instead of the default first segment.  
  - Keep the existing `fetchSegments` and `fetchCompanies` behaviour; do not change how companies are fetched.

### Tests (Search Database)

- `pipeline_buildWorkflowZeroLinkParams_encodes_segment_id`  
  - Given a segment id, returns `{ view: 'workflow-zero', segmentId }` for use in URLs.

- `pipeline_openWorkflowZeroForSegment_navigates_with_segment_query`  
  - Stubs `window.location.assign`, calls `openWorkflowZeroForSegment('seg-1')`, and asserts the URL contains `view=workflow-zero` and `segmentId=seg-1`.

- `pipeline_handleSearchDatabaseClick_requires_segment_before_navigate`  
  - With `completed.segment` undefined, clicking Search Database should not call `window.location.assign` and should set an appropriate error string.

- `app_resolveViewFromLocation_supports_workflow_zero_view`  
  - Asserts that `resolveViewFromLocation({ search: '?view=workflow-zero' })` yields `'workflow-zero'`.

- `app_renders_workflow_zero_view_when_query_param_set`  
  - In a jsdom test, stubs `window.location.search` to `'?view=workflow-zero'`, renders `<App />`, and asserts the Workflow Zero header text (e.g. its main title) is present.

- `workflow_zero_page_selects_segment_from_query_param`  
  - Mounts `WorkflowZeroPage` with `window.location.search` containing `segmentId=seg-1`, stubs `fetchSegments` to return `[{ id: 'seg-1', ... }]`, and asserts that the segment selector is set to `seg-1` and that `fetchCompanies` is called with `segment: 'seg-1'`.

## Implementation Plan – EXA Web Search Surfacing

### Behaviour

- Clicking **EXA Web Search** in the Segment step should:
  - Require a selected ICP (and ideally a segment, if that becomes a dependency later).  
  - Trigger `triggerIcpDiscovery` and show a status line under the tile (`Discovery run <id> started (<status>)`).  
  - Persist discovery metadata via `persistLatestDiscoveryRun` (already wired).  
  - If the trigger fails, show a clear error under the tile (not only inside the AI Chat modal).  
  - When a run is available, show a small CTA button “Review candidates in ICP Discovery” that uses `openIcpDiscoveryForLatestRun` to navigate; `IcpDiscoveryPage` then auto-loads candidates for that run as already implemented.

### Functions to Implement / Extend

- `handleRunDiscovery()` – `PipelineWorkspaceWithSidebar.tsx` (existing)  
  - Ensure it:  
    - Clears any previous `discoveryStatus` and new `discoveryError` before running.  
    - On success, sets `discoveryStatus` with provider + status and calls `persistLatestDiscoveryRun` (current behaviour).  
    - On failure, sets a new `discoveryError` string instead of only `aiError`, so errors are visible without opening AI Chat.

- `discoveryError` state + rendering – `PipelineWorkspaceWithSidebar.tsx`  
  - Add `const [discoveryError, setDiscoveryError] = useState<string | null>(null);`.  
  - In the Segment step UI, under the EXA Web Search tile’s status area, render `discoveryError` in a muted error style (similar to `aiError` in the chat modal).  
  - Keep `hasPersistedDiscoveryRun()` and the “Review candidates in ICP Discovery” button, but ensure they are rendered whenever a `runId` is available, regardless of whether `discoveryStatus` is set.

- `IcpDiscoveryPage` auto-load guard – `web/src/pages/IcpDiscoveryPage.tsx` (existing)  
  - Confirm that the existing `initialPersistedRunIdRef` + `autoLoadedCandidatesRef` guard only calls `loadCandidatesForRun()` once when `discoveryRunId` comes from persisted metadata; we may slightly tighten the condition to ensure deep-linked queries that explicitly include `runId` continue to work as expected.

### Tests (EXA Web Search)

- `pipeline_handleRunDiscovery_sets_discoveryStatus_on_success`  
  - Mocks `triggerIcpDiscovery` to resolve with `{ runId: 'run-1', provider: 'exa', status: 'running' }`, calls `handleRunDiscovery`, and asserts `discoveryStatus` contains `run-1` and `running`.

- `pipeline_handleRunDiscovery_sets_discoveryError_on_failure`  
  - Mocks `triggerIcpDiscovery` to reject with an error, calls `handleRunDiscovery`, and asserts `discoveryError` is set and rendered under the EXA Web Search tile.

- `pipeline_segment_step_renders_review_candidates_cta_when_run_persisted`  
  - With `sessionStorage['c5_latest_icp_discovery']` hydrated and the Segment step rendered, asserts the “Review candidates in ICP Discovery” button is visible and that clicking it calls `window.location.assign` with `view=icp-discovery`.

- `icp_discovery_auto_loads_candidates_for_persisted_run`  
  - Already covered by `auto_loads_candidates_when_discovery_run_is_persisted` in `IcpDiscoveryPage.test.tsx`; we keep this test as the check that the navigation from the CTA actually results in a candidate list.

## Out of Scope (for this Session)

- Adding a full `icp_coach_sessions` table or new backend endpoints for discovery.  
- Changing Exa discovery job semantics or the MCP-based Exa client; we treat `/api/icp/discovery/trigger` as a black box and only improve its surfacing in the UI.  
- Adding a new global router or nested routes beyond the lightweight `view` query param pattern already used for `icp-discovery`.

## Completed vs To Do (this Session)

- **Completed (pre-session context)**  
  - ICP, Hypothesis, Segment, Enrichment, Draft, and Send steps are wired to live adapter endpoints in the Pipeline workspace.  
  - Exa discovery candidates and promotion flows are implemented and test-covered in `IcpDiscoveryPage` and the CLI, including `persistLatestDiscoveryRun` helpers and auto-load logic from persisted metadata.  
  - Workflow Zero already maps segments to live company + contact lists using `/api/segments`, `/api/companies`, and `/api/contacts`.

- **To Do (this session)**  
  - Wire Search Database to Workflow Zero via a minimal `view=workflow-zero&segmentId=…` deep-link, with guardrails when no segment is selected.  
  - Make EXA Web Search visibly succeed or fail by surfacing discovery status, a dedicated error string, and a “Review candidates in ICP Discovery” CTA driven by persisted metadata.  
  - Update and extend tests for `PipelineWorkspaceWithSidebar`, `App`, `WorkflowZeroPage`, and `IcpDiscoveryPage` to cover the new wiring.  
  - Keep `CHANGELOG.md` and this session doc updated once the wiring is implemented and all tests (unit + web) are passing.

