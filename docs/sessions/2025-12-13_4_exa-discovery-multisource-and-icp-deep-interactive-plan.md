# Session Plan – 2025-12-13 Exa Discovery UX (A) → Multisource Enrichment (B) → ICP Deep Interactive Mode (C)

> Timestamp (UTC): 2025-12-13T08:25:00Z  
> Goal: Make Exa discovery runs easier to review from the Pipeline, take a small but concrete next step toward real multisource enrichment, and outline how we’ll deepen ICP interactive mode—implementing only the minimal functionality we need and avoiding any new legacy fallbacks.

## Short Overview

- **A – Exa Discovery UX (current focus)**  
  Let users trigger Exa discovery from the Pipeline segment step and quickly review the latest run in `IcpDiscoveryPage` without copying run ids manually, using simple deep-linking and lightweight metadata persistence.

- **B – Multisource Enrichment (next)**  
  Wire a minimal “real” behaviour for one non-Exa provider (e.g. Parallel.ai) through the existing enrichment registry in a safe, opt-in way, so we can validate the registry contract without changing job semantics.

- **C – ICP Deep Interactive Mode (outline for follow-up)**  
  Design how we will introduce explicit “create vs refine” controls and optional session logging for the ICP coach, building on the interactive helpers already added, without touching the coach LLM schema again.

The rest of this document details **A** for this session and sketches **B/C** at a high level for upcoming work.

---

## A – Exa Discovery UX (Pipeline → ICP Discovery)

### Behaviour and Constraints

- Keep all existing Exa discovery contracts and storage as-is:
  - `triggerIcpDiscovery` still orchestrates Exa websets/search, jobs, and candidate storage.
  - `IcpDiscoveryPage` continues to own candidate review and promotion into `companies` / `segment_members`.
- UX goals for this slice:
  - From the Pipeline segment step, **EXA Web Search** should:
    - Start a discovery run for the selected ICP/hypothesis.
    - Persist the `runId` (and ICP/hypothesis ids) in a place that `IcpDiscoveryPage` can read.
    - Surface a “Review candidates” call-to-action that opens `IcpDiscoveryPage` with the latest run prefilled.
  - From `IcpDiscoveryPage`, when launched via this path:
    - Prefill the Discovery run id field with the persisted `runId`.
    - Auto-select the associated ICP/hypothesis when ids are provided.
    - Optionally auto-load candidates for that run so users can approve/discard immediately.
- No new backend endpoints, DB columns, or Exa contracts; this is purely web-layer coordination.

### Files to Change (A)

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Extend the existing `handleRunDiscovery` to:
    - Persist discovery metadata using a small helper.
    - Set a visible “Review in ICP Discovery” state when a run is started.
  - Add a small CTA in the segment step UI that opens `IcpDiscoveryPage` with context (via query params or `sessionStorage`).

- `web/src/pages/IcpDiscoveryPage.tsx`
  - On mount, hydrate `discoveryRunId`, `selectedProfileId`, and `selectedHypothesisId` from persisted discovery metadata and/or query params when present.
  - Optionally auto-invoke `loadCandidatesForRun` when a valid `runId` is hydrated.

- `web/src/App.tsx`
  - Introduce a minimal “router” that can switch between the Pipeline Workspace and `IcpDiscoveryPage` based on `window.location` (e.g. a `?view=icp-discovery` query param), without adding a routing library.

- `web/src/apiClient.ts`
  - Confirm `triggerIcpDiscovery` and `fetchIcpDiscoveryCandidates` return types include the fields we need (`runId`, `status`, `provider`), adjusting types only if necessary.

- Tests:
  - `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - `web/src/pages/IcpDiscoveryPage.test.tsx`
  - `web/src/App.test.tsx`

### Functions to Implement or Extend (A)

- `buildDiscoveryLinkParams({ runId, icpProfileId, icpHypothesisId })` (`PipelineWorkspaceWithSidebar.tsx`)
  - Constructs a small `{ view: 'icp-discovery', runId, icpId, hypothesisId }` object suitable for encoding as query params; keeps naming consistent between pages.

- `openIcpDiscoveryForLatestRun()` (`PipelineWorkspaceWithSidebar.tsx`)
  - Reads the latest persisted discovery metadata (using `getPersistedDiscoveryRun`), builds a query string via `buildDiscoveryLinkParams`, and uses `window.location.assign` to navigate to `?view=icp-discovery&…` while leaving the backend untouched.

- `hydrateDiscoveryContextFromLocation()` (`IcpDiscoveryPage.tsx`)
  - Parses `window.location.search` and merges any discovery metadata present there with `getPersistedDiscoveryRun()`, then sets `discoveryRunId`, `selectedProfileId`, and `selectedHypothesisId` state if they are not already set.

- `useAutoLoadDiscoveryCandidates()` (`IcpDiscoveryPage.tsx`)
  - A tiny hook or inline `useEffect` that, when `discoveryRunId` is non-empty on first render, calls `loadCandidatesForRun()` and suppresses duplicate calls when users manually click “Load candidates”.

- `resolveViewFromLocation()` (`web/src/App.tsx`)
  - Reads `window.location.search` and returns a union type (e.g. `'pipeline' | 'icp-discovery'`) so `App` can render either the Pipeline Workspace or `IcpDiscoveryPage` without adding a routing dependency.

### Tests (A – Names and Behaviour)

- `pipeline_buildDiscoveryLinkParams_encodes_run_and_icp_ids`
  - Given a run id and ICP/hypothesis ids, builds predictable key/value pairs.

- `pipeline_openIcpDiscoveryForLatestRun_uses_persisted_metadata_in_location`
  - Persists a discovery record into `sessionStorage`, calls the helper, and asserts `window.location.assign` receives the expected query string.

- `icpDiscovery_hydrateDiscoveryContextFromLocation_prefills_run_and_selections`
  - With `?view=icp-discovery&runId=…&icpId=…` and no prior state, the page sets `discoveryRunId` and selection ids accordingly on mount.

- `icpDiscovery_useAutoLoadDiscoveryCandidates_fetches_on_hydrated_runId`
  - When `discoveryRunId` is set during hydration, `fetchIcpDiscoveryCandidates` is called without an explicit button click.

- `app_renders_icp_discovery_when_view_query_is_set`
  - Asserts that `App` renders `IcpDiscoveryPage` instead of the Pipeline Workspace when `window.location.search` includes `view=icp-discovery`.

---

## B – Multisource Enrichment (minimal live provider wiring)

> This phase should be scoped tightly to avoid overcommitting; we only wire one non-Exa provider end to end in a safe, opt-in way.

### Behaviour and Constraints

- Keep Exa as the primary, battle-tested enrichment provider.
- Pick **one** additional provider—likely Parallel.ai—for a basic live path:
  - Only for company-level enrichment.
  - Behind an explicit `--provider parallel` flag and corresponding env vars.
- No job semantics changes:
  - `enrich:run` remains async-first and JSON-only.
  - We reuse `enqueueSegmentEnrichment` and `runSegmentEnrichmentOnce` to handle jobs.

### Files to Change (B)

- `src/integrations/parallel.ts`
  - Implement `researchCompany` to call a minimal Parallel endpoint (or a stable stub) using `ParallelEnvConfig`.

- `src/services/enrichment/registry.ts`
  - Update `createEnrichmentProviderRegistry` to pass a richer context into the Parallel adapter (e.g., company name + website at least).

- `src/services/enrichSegment.ts`
  - Ensure that when `adapter: 'exa'` and `provider: 'parallel'` (or similar combination) is used, `runSegmentEnrichmentOnce` resolves to the Parallel-backed adapter via the registry.

- `tests/enrichmentProviders.test.ts`
  - Add targeted tests for the Parallel path.

### Functions to Implement or Extend (B)

- `buildParallelClientFromEnv(envLoader?)` (`src/integrations/parallel.ts`)
  - Extend the existing shape-only client to call a small Parallel endpoint (or a clearly documented stub) for `researchCompany`, returning a predictable `{ summary, sources }` shape.

- `createParallelEnrichmentAdapter(supabase, parallelClient)` (`src/services/enrichment/registry.ts`)
  - Already present; we tighten its mapping to ensure the payload includes provider and entity labels, and keep it aligned with Exa’s result shape for downstream use.

- `runParallelEnrichmentForCompanies(job, options)` (`src/services/enrichSegment.ts`)
  - A small internal helper (if needed) that runs the Parallel adapter over the job’s company targets and writes a minimal research payload into `companies.company_research`.

### Tests (B – Names and Behaviour)

- `parallel_client_researchCompany_uses_env_base_and_key`
  - Verifies the Parallel client constructs the URL and auth headers correctly from env.

- `parallel_enrichment_adapter_sets_provider_and_entity_labels`
  - Ensures Parallel enrichment results include `provider: 'parallel'` and `entity: 'company'`.

- `enrich_run_with_parallel_provider_uses_parallel_adapter`
  - With `--provider parallel`, jobs route through the Parallel adapter instead of Exa.

---

## C – ICP Deep Interactive Mode (outline)

> This section sketches the next layer of ICP interactive behaviour; full implementation will be planned in a dedicated follow-up session.

### Behaviour and Constraints

- Build on the existing expressive/interactive helpers:
  - `appendInteractiveCoachMessage`, `buildInteractiveIcpPrompt`, `buildInteractiveHypothesisPrompt`.
- Introduce explicit **mode controls**:
  - Users can choose whether a coach run should **create a new** ICP/hypothesis or **refine the selected** one.
- Consider—but do not yet implement—a lightweight `icp_coach_sessions` representation:
  - Likely a derived view or JSON snapshot rather than a new table in this first iteration.

### Files to Touch (C)

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Add UI toggles (e.g. “Create new” vs “Refine current”) to the AI Assistant when in ICP/Hypothesis steps.
  - Extend `handleAiSend` to respect these toggles when choosing how to apply coach outputs.

- `web/src/pages/IcpDiscoveryPage.tsx`
  - Mirror the same mode controls for `runCoachIcpGeneration` / `runCoachHypothesisGeneration`.

- `tests/icpCoach.test.ts`, `tests/coach.test.ts`
  - Add tests that ensure repeated runs still map into valid `icp_profiles` / `icp_hypotheses` regardless of mode, and that phase outputs remain consistent.

### Example Functions (C)

- `resolveCoachRunMode(state)` (`PipelineWorkspaceWithSidebar.tsx`)
  - Returns `'create' | 'refine'` based on the current pipeline step and whether an ICP/hypothesis is already selected, with an optional explicit override used by future UI toggles.

- `applyCoachResultToState(mode, entityType, result)` (`PipelineWorkspaceWithSidebar.tsx`)
  - Centralises how coach results update the ICP/hypothesis lists for create vs refine runs (create prepends a new entity; refine replaces the currently selected one), while step navigation continues to use the existing `handleSelectExisting` helper.

### Example Tests (C – Names and Behaviour)

- `pipeline_resolveCoachRunMode_defaults_to_create_when_none_selected`
  - With no ICP/hypothesis selected, the helper returns `'create'`.

- `pipeline_applyCoachResultToState_refine_updates_selected_entity`
  - In refine mode, the helper replaces the currently selected ICP/hypothesis in the local list instead of simply prepending another copy.

---

## Completed vs To Do (for this session)

- **Completed (pre-session context)**  
  - Exa discovery runs, candidate review, and promotion flows are implemented and tested (CLI + Web).  
  - Enrichment registry and adapters for Exa/Parallel/Firecrawl/Anysite exist, with env validation and async job orchestration in place.  
  - ICP coach Express mode, phase-aware storage, and interactive helpers in the Pipeline Workspace are in place and covered by tests.

- **Completed (this session)**  
  - Implemented Exa Discovery UX deep-linking end to end: discovery runs triggered from the Pipeline segment step now persist metadata via `persistLatestDiscoveryRun`, surface a “Review candidates in ICP Discovery” CTA conditioned on `hasPersistedDiscoveryRun`, and navigate via `openIcpDiscoveryForLatestRun` using the lightweight `view=icp-discovery` query switch in `App`.  
  - Updated `IcpDiscoveryPage` to hydrate `discoveryRunId`, profile, and hypothesis selection from the persisted discovery record and to auto-load candidates once when launched from a deep-linked run id, keeping manual “Load candidates” behaviour unchanged for hand-typed run ids.  
  - Implemented a minimal Parallel.ai enrichment stub: `buildParallelClientFromEnv` now returns a non-throwing client whose `researchCompany` / `researchContact` methods emit `{ provider: 'parallel', summary, sources }` payloads, and `createEnrichmentProviderRegistry` maps the `parallel` adapter into this shape so `runSegmentEnrichmentOnce` can safely write Parallel-backed research alongside Exa.  
  - Landed the first ICP Deep Interactive helpers: `resolveCoachRunMode` infers `'create' | 'refine'` from step and selection state, `applyCoachResultToState` updates ICP/hypothesis lists accordingly, and `handleAiSend` now uses these helpers so “refine” runs reuse the latest summaries in prompts and replace the selected ICP/hypothesis in local state without changing backend contracts.

- **To Do (follow-up / future sessions)**  
  - Decide whether and how to evolve the Parallel.ai stub into a live HTTP client (or a configurable external worker) once a real Parallel environment is available, keeping the existing `{ provider, entity, summary, sources, payload }` shape stable for downstream consumers.  
  - Implement explicit `'create' | 'refine'` ICP coach mode toggles in the Pipeline AI Assistant and `IcpDiscoveryPage`, plus helper-level tests, while keeping the current Express-mode LLM schema unchanged.  
  - Revisit this session doc and `CHANGELOG.md` when Parallel live wiring or ICP deep interactive mode moves from design into implementation.
