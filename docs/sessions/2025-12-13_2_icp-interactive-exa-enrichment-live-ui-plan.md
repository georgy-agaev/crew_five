# Session Plan – 2025-12-13 ICP Interactive UX (A) → Exa Enrichment (B) → Live UI/Telemetry (C)

> Timestamp (UTC): 2025-12-13T07:51:00Z  
> Goal: Progress through A → B → C in sequence, starting with an interactive ICP coach experience on the existing pages, then closing out Exa enrichment phase 1, and finally hardening live web UI data and telemetry—implementing only the functionality we need, without introducing new legacy fallbacks.

## Short Overview

- **A – Interactive ICP Coach UX (current focus)**  
  Make the ICP coach feel interactive on the Web UI by layering a lightweight chat transcript and readable summaries around existing Express-mode coach calls on `IcpDiscoveryPage` and the Pipeline Workspace, without changing backend contracts or storage.

- **B – Exa Enrichment Phase 1 (next)**  
  Finish the initial Exa enrichment path so campaigns can reliably enrich segments via Exa, with clear error surfaces, stable adapter wiring, and up-to-date docs/tests—reusing the existing enrichment registry and keeping scope tight to phase 1.

- **C – Live Web UI Data & Telemetry (later in this series)**  
  Stabilize the web UI when running against the live adapter: ensure all key views use real endpoints, show clear loading/error states, and expose basic telemetry (status/health indicators) without adding new backend features.

The rest of this document focuses in detail on **A – Interactive ICP Coach UX** for this session, and outlines B/C at a high level for upcoming work.

---

## A – Interactive ICP Coach UX (Phase 1 for this session)

### Behaviour and Constraints

- Reuse the **existing Express-mode coach endpoints and typed phase structures**:
  - `/api/coach/icp` / `/api/coach/hypothesis`.
  - `icp_profiles.phase_outputs` and `icp_hypotheses.search_config.phases`.
- Avoid any backend/schema changes:
  - All changes are frontend-only (React components and their tests).
  - No new LLM contracts or legacy fallbacks; we work with the existing JSON schema.
- UX goals:
  - On **Pipeline Workspace**, we already added an interactive AI Assistant transcript; this session keeps that behaviour and may only polish it if needed.
  - On **IcpDiscoveryPage**, add an inline “conversation-style” view that:
    - Shows the user’s last prompt when running ICP/Hypothesis via coach.
    - Shows the resulting ICP/Hypothesis summaries as assistant messages using the same summary mapping we already use in the page.
  - Keep transcripts **local and ephemeral** (per view) for now—no persistence beyond the current page load.

### Files to Change (A)

- `web/src/pages/IcpDiscoveryPage.tsx`
  - Add small state for ICP/Hypothesis coach transcripts and wire it into `runCoachIcpGeneration` / `runCoachHypothesisGeneration`.
  - Render a simple conversation panel near the coach controls, showing the user’s last prompt(s) and assistant summaries derived from the selected profile/hypothesis.

- `web/src/pages/IcpDiscoveryPage.test.tsx`
  - Add tests that verify:
    - Coach actions still call the expected API functions.
    - The transcript panel shows the user prompt and a summary snippet when mocked coach responses include typed phase outputs.

- (Optional, only if needed for reuse) `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - If we decide to share formatting helpers, consider exporting a tiny utility from here or duplicating minimal logic in `IcpDiscoveryPage` to avoid cross-file complexity.

### Options and Decision (A – interactive ICP on IcpDiscoveryPage)

1. **Option A1 – Simple “last run” transcript (chosen for this session)**  
   - Keep a short list (e.g., last 3 messages) per mode (ICP / Hypothesis).  
   - Each run appends:
     - One user message (the prompt text).
     - One assistant message (formatted summary based on `icpSummary` / `hypothesisSummary`).  
   - Keeps the UI light and avoids long histories.

2. **Option A2 – Full in-page chat thread**  
   - Maintain a longer transcript of all ICP/Hypothesis runs in this page session.  
   - Potentially adds controls to clear history without leaving the page.  
   - Higher complexity; better suited for a later iteration.

3. **Option A3 – “Run log” panel only (no explicit chat bubbles)**  
   - Append structured entries (timestamp, prompt, key metrics) to a flat log.  
   - Simpler visually but less “chat-like” for users.  
   - We can fall back to this if chat layout becomes too noisy.

**Decision:** Start with **Option A1**—a simple “last run” chat-like transcript—reusing summary logic we already have on the page. If we hit UX complexity, we can refine toward A3 without backend changes.

### Functions to Implement or Extend (A)

> Note: Function names are scoped to `web/src/pages/IcpDiscoveryPage.tsx` unless otherwise noted.

- `formatIcpSummaryForChatDiscovery(summary)`  
  - Takes the existing `icpSummary` object and returns a compact string highlighting value prop, industries/sizes, and key pains/triggers suitable for display as an assistant message.

- `formatHypothesisSummaryForChatDiscovery(summary)`  
  - Takes `hypothesisSummary` and returns a one-line or two-line summary covering hypothesis label, regions, and the first offer/critique if present.

- `appendDiscoveryChatMessage(messages, message)`  
  - Pure helper: returns a new messages array with the new message appended, keeping the original unchanged and optionally trimming to a max length for the transcript.

- `runCoachIcpGeneration` (existing, extended)  
  - After a successful coach call:
    - Uses the updated profile selection + `icpSummary` to build an assistant message via `formatIcpSummaryForChatDiscovery`.  
    - Updates ICP transcript state with a user message (the prompt text) and an assistant message (the formatted summary).

- `runCoachHypothesisGeneration` (existing, extended)  
  - After a successful coach call:
    - Uses the updated hypothesis selection + `hypothesisSummary` to build an assistant message.  
    - Updates hypothesis transcript state similarly.

### Planned Tests (A)

> Target file: `web/src/pages/IcpDiscoveryPage.test.tsx`

- `appendDiscoveryChatMessage_appends_without_mutating_original_array`  
  - Given an initial messages array, expect helper returns new array with added message and does not alter the original.

- `formatIcpSummaryForChatDiscovery_uses_value_prop_and_industries`  
  - Given a populated summary, ensure formatted string contains value prop and one of the industries.

- `formatHypothesisSummaryForChatDiscovery_includes_label_and_offer_fragments`  
  - Given a summary with regions/offers/critiques, ensure formatted string includes label, region, and part of the first offer/critique.

---

## B – Exa Enrichment Phase 1 (outline for next session)

> Detailed implementation will be planned in its own follow-up session; this section outlines scope and main files only.

### High-Level Behaviour

- Use the existing Exa client/adapter to enrich **segments** with company/employee research data.  
- Ensure:
  - Clear adapter selection via config/flags.
  - Robust error handling and telemetry for Exa runs.
  - No new legacy enrichment modes; we strictly use the current registry/adapter pattern.

### Likely Files to Touch (B)

- `src/services/enrichment/*` – Exa enrichment adapter(s) and registry wiring.  
- `src/web/server.ts` – Enrichment endpoints, if gaps remain for Exa.  
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx` – Enrichment step UI and status messages.  
- `tests/enrichment*.test.ts` – Service-level tests for Exa adapter behaviour.  
- `docs/sessions/2025-12-05_2_exa-enrichment-phase-1-plan.md` – Mark Completed vs To Do.  
- `docs/Database_Description.md` – Document enriched fields if not already covered.

### Example Functions (B – to refine later)

- `getEnrichmentAdapter(provider)`  
  - Returns the configured enrichment adapter instance (including Exa) based on provider name, with clear errors on unknown adapters.

- `enqueueExaEnrichmentJob(input)`  
  - Creates and enqueues an async job for Exa enrichment, capturing segment id, adapter, and options.

### Example Tests (B – to refine later)

- `exa_enrichment_adapter_maps_search_results_into_company_research`  
  - Given a mock Exa response, mapping lands in the expected JSON column.

- `enqueue_exa_enrichment_job_persists_job_with_segment_metadata`  
  - Job row captures segment id, adapter, and config flags.

---

## C – Live Web UI Data & Telemetry (outline for later)

> As with B, detailed steps will be captured in a dedicated session doc; this outline highlights scope and key targets.

### High-Level Behaviour

- When running the web app against the live adapter:
  - All main pages (Pipeline, ICP Discovery, Prompts, Inbox, Analytics) should use real `/api/*` endpoints instead of mocks.  
  - Users should see:
    - Explicit loading states while data is fetching.
    - Clear error messages when API calls fail.
    - A simple, trustworthy “status/health” stripe showing adapter/LLM/enrichment readiness.

### Likely Files to Touch (C)

- `web/src/apiClient.ts` – Ensure all major flows use live endpoints and surface errors consistently.  
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx` – Status header, loading/error states, live-data wiring.  
- `web/src/pages/IcpDiscoveryPage.tsx` – Loading/error states and live ICP discovery from backend.  
- `web/src/pages/PromptRegistryPage.tsx` – Robust error messaging for prompt registry.  
- `docs/sessions/2025-11-25_14_web-ui-live-data-plan.md` – Completed vs To Do.  
- `CHANGELOG.md` – Note live-mode UX hardening.

### Example Functions (C – to refine later)

- `mapApiErrorToUserMessage(err)`  
  - Normalizes API errors into concise, user-friendly messages for UI components.

- `useLiveStatusPolling()`  
  - Optional hook that periodically hits a `/meta` or `/services` endpoint and exposes aggregated readiness info to top-level pages.

### Example Tests (C – to refine later)

- `pipeline_workspace_shows_loading_and_error_states_for_services`  
  - Mocks failing `/api/services` calls and asserts UI shows clear, non-blocking error messages.

- `icp_discovery_page_uses_live_discovery_and_handles_failures`  
  - Mocks `triggerIcpDiscovery` and `fetchIcpDiscoveryCandidates` failures and checks error banners.

---

## Summary for This Session (A-first)

- **Current session focus:** A – Interactive ICP Coach UX.  
- **Concrete next coding steps (following this plan):**
  - Implemented `formatIcpSummaryForChatDiscovery`, `formatHypothesisSummaryForChatDiscovery`, and `appendDiscoveryChatMessage` in `IcpDiscoveryPage`, delegating to the shared Pipeline helpers to keep formatting DRY, with dedicated unit tests.  
  - Extended `runCoachIcpGeneration` / `runCoachHypothesisGeneration` so each coach run appends a user message (prompt text) and an assistant message (phase-derived summary) into local transcript state, using freshly re-fetched profile/hypothesis rows.  
  - Rendered a compact “Coach conversation (latest runs)” panel on `IcpDiscoveryPage` that shows the last few ICP and Hypothesis exchanges, making Express-mode coach runs feel conversational without altering backend contracts.  
  - Ran `pnpm lint`, `pnpm build`, and `pnpm vitest run web/src/pages/IcpDiscoveryPage.test.tsx`; all 11 tests are green.
