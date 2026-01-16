# Session Plan – 2025-12-12 ICP Coach Interactive UI and E2E (A → B → C)

> Timestamp (UTC): 2025-12-12T22:25:01Z  
> Goal: Layer Interactive Chat with AI flows, UI surfacing for ICP coach phase outputs, and Playwright/DevTools E2E checks on top of the typed coach + storage work completed earlier.

## Short Overview

- **A – Interactive Chat with AI (phases 1–5)**  
  Extend the existing ICP “Chat with AI” entry points (ICP Discovery page + Workflow Hub) so they can run Express-mode ICP coach calls with user-controlled prompts, while preparing the UI and data contract for a future multi-step phase UX without changing storage again.

- **B – UI surfacing of `phase_outputs`**  
  Add lightweight, read-only panels in ICP-related views that display key fields from `icp_profiles.phase_outputs` (value proposition, industries, pains, decision makers, triggers, data sources) and from `icp_hypotheses.search_config.phases`, giving users visibility into what the coach actually saved.

- **C – Playwright + DevTools E2E checks**  
  Use Playwright and the Chrome DevTools MCP to drive the Web UI end-to-end: create/select prompts, run the coach flows, and assert that live UI elements reflect the structured ICP/hypothesis data and model availability.

The focus is on implementing only what’s needed to make ICP coach runs feel real in the UI and verifiable end-to-end, without introducing new legacy fallback modes or prompt bypasses.

## A – Interactive Chat with AI (phases 1–5)

### Behaviour and Constraints

- Keep Express mode as the underlying contract for this session:
  - Single coach call per ICP or Hypothesis run, producing the typed JSON we already persist into `icp_profiles` / `icp_hypotheses`.
  - Prompt Registry remains the source of the system prompt (`prompt_registry.prompt_text`), with the Markdown scaffold as fallback only when no prompt is configured.
- Interactive behaviour is “single shot but configurable” rather than a full multi-turn wizard in this session:
  - Users can:
    - Choose the system prompt via the Prompts tab / Settings.
    - Provide a rich `userPrompt` text in Chat with AI inputs.
    - Trigger Express coach runs from both ICP Discovery and Workflow Hub.
  - Future sessions can turn this into a multi-phase dialogue without changing the underlying data model.

### Files to Touch (A)

- `web/src/pages/IcpDiscoveryPage.tsx`
  - Reuse the existing `runCoachIcpGeneration` and `runCoachHypothesisGeneration` entry points but:
    - Ensure they treat the user-entered text as `userPrompt` rather than duplicating the name/label.
    - Make it obvious that these calls run on top of the typed coach (and that results will appear in the new phase outputs panel added in B).
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Extend `handleAiSend` ICP/Hypothesis branches to:
    - Accept multi-line Chat with AI input as `userPrompt`.
    - Allow users to see a minimal summary of what was generated (e.g., ICP/hypothesis name/label and jobId).
- `web/src/apiClient.ts`
  - Confirm `generateIcpProfileViaCoach` / `generateHypothesisViaCoach` already forward `userPrompt`, `promptId`, `provider`, and `model`, and refine their return types if needed for the new UI.
- `tests/icpCoach.test.ts`, `tests/coach.test.ts`, `web/src/apiClient.test.ts`
  - Add small focused tests that assert:
    - `userPrompt` is passed through to the coach when supplied.
    - The API client forwards the correct fields for ICP/Hypothesis coach calls from the UI.

### Functions (A) and Their Roles

- `runCoachIcpGeneration` (IcpDiscoveryPage)  
  Uses Settings + Task Prompts to call `generateIcpProfileViaCoach` with a user-entered `userPrompt`, then refreshes ICP profiles and highlights the newly generated one.

- `runCoachHypothesisGeneration` (IcpDiscoveryPage)  
  Similar to the profile function, but targeting `generateHypothesisViaCoach` for the selected ICP profile; uses the free-form hypothesis text as `userPrompt`.

- `handleAiSend` (PipelineWorkspaceWithSidebar, ICP/hypothesis branches)  
  Takes the Chat with AI textarea content, determines whether the current step is ICP or Hypothesis, and triggers the corresponding coach call with the same `userPrompt` and the active promptId/provider/model configuration.

- `generateIcpProfileViaCoach` / `generateHypothesisViaCoach` (web/src/apiClient.ts)  
  Minimal Web API client helpers that POST to `/coach/icp` and `/coach/hypothesis`, forwarding `userPrompt`, `promptId`, `provider`, `model` and shaping responses into UI-friendly objects.

### Planned Tests (A)

- `icp_coach_profile_uses_user_prompt_when_provided`  
  Ensure Express coach uses userPrompt instead of derived fields.

- `api_client_generate_icp_profile_forwards_user_prompt_and_prompt_id`  
  Check POST body has `userPrompt`, `promptId`, `provider`, `model`.

- `PipelineWorkspace_handleAiSend_routes_to_icp_or_hypothesis_correctly`  
  Verify Chat with AI uses correct task prompt and provider/model.

## B – UI Surfacing of `phase_outputs`

### Behaviour

- When an ICP profile is selected:
  - Show a compact “ICP Summary” panel that pulls from:
    - `icp_profiles.company_criteria` (valueProp, industries, pains, triggers, dataSources).
    - `icp_profiles.persona_criteria` (roles, decisionMakers).
    - `icp_profiles.phase_outputs` (used as the canonical source when present).
- When a hypothesis is selected:
  - Show a summary of:
    - `icp_hypotheses.search_config` (region/size/etc.).
    - `search_config.phases.phase4.offers[]` and `phase5.critiques[]` as a compact list.

### Files to Touch (B)

- `web/src/pages/IcpDiscoveryPage.tsx`
  - Add a right-hand panel under the “ICP profiles & hypotheses” card that:
    - Fetches the selected ICP profile + hypothesis details once.
    - Renders human-friendly summaries from `company_criteria`, `persona_criteria`, and `phase_outputs`.
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Add an ICP/Hypothesis “Details” box in the pipeline sidebar (or main panel) that:
    - Shows the current ICP’s value proposition and key bullets.
    - Shows the current hypothesis’ label + key offers.
- `src/web/server.ts`
  - Ensure `/api/icp/profiles` and `/api/icp/hypotheses` endpoints are returning the full JSON columns (including `company_criteria`, `persona_criteria`, `phase_outputs`, `search_config`).

### Functions (B) and Their Roles

- `renderIcpSummary(profile)` (new, React helper in IcpDiscoveryPage)  
  Given a profile row, derives display-safe strings for value proposition, industries, pains, and main decision makers using `phase_outputs` when available, falling back to `company_criteria` / `persona_criteria`.

- `renderHypothesisSummary(hypothesis)` (new, React helper in IcpDiscoveryPage or shared)  
  Formats the hypothesis label plus any `search_config.phases.phase4.offers` and `phase5.critiques` into a simple list for the UI.

- `getSelectedIcpProfile` / `getSelectedIcpHypothesis` helpers (inline or small functions)  
  Locate the currently selected ICP/hypothesis and hand the row off to the summary renderers above.

### Planned Tests (B)

- `icp_discovery_page_renders_icp_summary_from_phase_outputs`  
  Mounts the page with a mock ICP profile containing `phase_outputs` and checks summary text.

- `icp_discovery_page_renders_hypothesis_summary_from_search_config_phases`  
  Ensures offers/critiques appear when hypothesis has `phases`.

- `server_icp_endpoints_include_phase_outputs_and_search_config`  
  Confirms `/api/icp/profiles` and `/api/icp/hypotheses` responses expose the new JSON fields.

## C – Playwright + DevTools E2E (LLM models + coach flows)

### Behaviour

- Run a headless E2E scenario using Playwright plus the Chrome DevTools MCP:
  - Ensure the Workspace Hub shows LLM connectivity (OpenAI/Anthropic with model lists).
  - Create or select system prompts in the Prompts tab (if needed).
  - Use Chat with AI to:
    - Generate an ICP via coach.
    - Generate a hypothesis via coach for that ICP.
  - Verify:
    - The ICP/Hypothesis details panels show the expected fields (valueProp, industries, offers).
    - No unhandled errors appear in the console.

### Files / Tools to Touch (C)

- E2E harness (no app code changes expected):
  - Add a Playwright scenario using the `playwrigh` MCP:
    - Navigate to the web app.
    - Drive the Prompts tab / ICP Discovery / Workflow Hub flows.
  - Use Chrome DevTools MCP if needed to capture screenshots or console logs for regression tracking.

### E2E Steps (C) – High Level

1. `Playwright_navigate` to the web adapter (`VITE_API_BASE` runtime).
2. Open Prompts tab:
   - Ensure at least one ICP and Hypothesis prompt entry exists; create them if missing.
3. Open ICP Discovery:
   - Use “Generate via coach” for a new ICP.
   - Use “Generate via coach” for a hypothesis tied to that ICP.
4. Assert:
   - ICP summary panel shows non-empty valueProp and industry fields.
   - Hypothesis summary panel shows at least one offer.
5. Capture screenshot(s) for session documentation.

### Planned E2E Checks (C)

- `playwright_icp_coach_flow_generates_profile_and_hypothesis`  
  Full browser flow: create prompts, run coach, check UI summaries.

- `playwright_llm_models_panel_shows_connected_providers`  
  Confirm LLM Services section shows OpenAI/Anthropic with models listed.

## Summary of Files to Change

- **TypeScript services & storage (already wired, but used here)**  
  - `src/services/icpCoach.ts` – consume typed phases (no new changes planned this session, but central to behaviour).  
  - `src/services/coach.ts` – already maps phases into criteria + `phase_outputs`.
  - `src/services/icp.ts` – accepts `phaseOutputs` and writes `phase_outputs`.

- **Web UI – ICP flows and Chat with AI**  
  - `web/src/pages/IcpDiscoveryPage.tsx` – interactive ICP/Hypothesis coach triggers + summary panels.  
  - `web/src/pages/PipelineWorkspaceWithSidebar.tsx` – pipeline-level Chat with AI ICP/Hypothesis integration + ICP/Hypothesis detail views.
  - `web/src/apiClient.ts` – coach API client mapping remains lean but may get minor typing refinements.

- **Backend adapter**  
  - `src/web/server.ts` – ensure ICP endpoints expose the necessary JSON columns unchanged.

- **Tests**  
  - `tests/icpCoach.test.ts` – coach input/output wiring (userPrompt).  
  - `tests/coach.test.ts` – reinforce invariants around criteria mapping if needed.  
  - `web/src/apiClient.test.ts`, `web/src/pages/IcpDiscoveryPage.test.tsx`, `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` – new/extended cases for ICP/Hypothesis summaries and coach triggers.
  - Playwright scenarios via the `playwrigh` MCP tools for E2E.

## Status Update (end of 2025-12-12)

- **Completed (A → B → C)**  
  - Confirmed Web API clients already forward `userPrompt`, `promptId`, `provider`, and `model` for ICP/Hypothesis coach calls; existing tests in `web/src/apiClient.test.ts` assert the request shapes.  
  - Added ICP and Hypothesis summary panels to `web/src/pages/IcpDiscoveryPage.tsx` that read from `company_criteria`, `persona_criteria`, `phase_outputs`, and `search_config.phases` to display value prop, industries, pains, decision makers, triggers, regions, offers, and critiques.  
  - Implemented `buildIcpSummaryFromProfile` and `buildHypothesisSummaryFromSearchConfig` helpers in `PipelineWorkspaceWithSidebar`, and wired the “Current Configuration” sidebar to render ICP/Hypothesis summaries that prefer `phase_outputs` / `search_config.phases` and gracefully fall back to flattened criteria.  
  - Extended `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` with helper-level cases covering phase-aware and fallback summaries; `pnpm lint`, `pnpm build`, and the focused Vitest run all pass.  
  - Ran a Playwright-driven E2E pass against `http://localhost:5173`, creating an ICP and hypothesis through the quick-entry paths, opening the AI Assistant while on the Hypothesis step, and capturing a full-page screenshot (`e2e_pipeline_icp_hypothesis_summary-2025-12-13T00-16-54-149Z.png`) showing the updated “Current Configuration” panel with selected ICP/Hypothesis and live LLM status badges.

- **To Do (future sessions)**  
  - Confirm, with stable provider keys, that coach-generated ICP and hypothesis runs populate `phase_outputs` / `search_config.phases` in production-like environments and that the Pipeline summaries show non-empty “Value prop”, “Industries”, “Offers”, and “Critiques” lines after those runs.  
  - Add a lightweight, scripted Playwright scenario (or CI hook) that asserts the presence of non-empty summary lines after a coach run and flags regression when the panel becomes empty.  
  - Expand docs with end-user operator notes on how to use the Pipeline Workspace summaries when iterating on ICP/hypothesis prompts (Express vs Interactive modes), referencing the screenshot captured in this session.
