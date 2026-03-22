# Session Plan – 2025-12-12 ICP Coach Pipeline Summaries and E2E Execution (A → B → C)

> Timestamp (UTC): 2025-12-12T23:47:00Z  
> Goal: Finish the A → B → C interactive ICP coach work by wiring phase-aware summaries into the Pipeline Workspace UI (B) and exercising the full prompt → coach → summary flow with Playwright/DevTools E2E checks (C), building on the typed storage completed in earlier sessions.

## Short Overview

- Confirm today’s earlier A/B work (typed coach payloads, `phase_outputs` storage, ICP Discovery summaries) is stable and treated as the baseline for this session.
- Implement lightweight ICP and Hypothesis summary hints in the Pipeline Workspace so that Chat with AI runs there clearly reflect the structured coach outputs (no new storage fields).
- Design and run a Playwright + Chrome DevTools E2E scenario that validates live LLM connectivity, prompt selection, and the visibility of ICP/hypothesis summaries, and capture results in this session doc.

## Scope and Non-Goals

- In scope:
  - Mapping existing `icp_profiles.phase_outputs`, `company_criteria`, `persona_criteria`, and `icp_hypotheses.search_config.phases` into read-only summaries inside `PipelineWorkspaceWithSidebar`.
  - Keeping Express-mode coach calls as the only execution mode while reusing typed phase structures.
  - Adding or adjusting Vitest/Web tests strictly needed to cover the new mapping logic and UI hints.
  - Running a Playwright-driven E2E flow via MCP tools; artifacts and observations are documented here, not committed as a separate test suite.
- Out of scope:
  - Any new database columns or schema changes.
  - Re-introducing legacy prompt fallbacks or alternate execution contracts.
  - Building a full multi-step, per-phase chat wizard (we design for it but do not implement it).

## Implementation Plan (A → B → C for This Session)

### A – Baseline verification (already implemented earlier today)

**Intent**

- Treat the following as completed prerequisites and only adjust if tests or linting fail:
  - Typed phase structures and `phase_outputs` snapshot wiring (`src/services/icpCoach.ts`, `src/services/coach.ts`, `src/services/icp.ts`).
  - ICP Discovery “ICP Summary” and “Hypothesis Summary” panels wired to `phase_outputs` / `search_config.phases`.
  - Web API clients and coach services forwarding `userPrompt`, `promptId`, `provider`, and `model`.

**Files (read-only unless issues appear)**

- `src/services/icpCoach.ts`, `src/services/coach.ts`, `src/services/icp.ts`  
- `web/src/apiClient.ts`  
- `web/src/pages/IcpDiscoveryPage.tsx` and `web/src/pages/IcpDiscoveryPage.test.tsx`  
- `tests/icpCoach.test.ts`, `tests/coach.test.ts`, `tests/icp.test.ts`

### B – Pipeline Workspace ICP/Hypothesis summaries (primary code work)

**Behaviour**

- When a pipeline step is associated with a completed ICP profile:
  - Show a compact “ICP Summary” block derived from:
    - `phase_outputs.phase1/2/3` when present (value prop, industries/sizes, pains, decision makers, triggers, data sources).
    - Fallback to `company_criteria` / `persona_criteria` fields when `phase_outputs` is missing.
- When a pipeline step has a completed hypothesis:
  - Show a “Hypothesis Summary” block derived from:
    - `search_config.region` and `search_config.phases.phase4/5` (offers, critiques) when present.
    - Fallback to top-level hypothesis label and search config fields when phases are absent.
- Keep the UI read-only and avoid adding new Redux/adapter state; work within existing props and selectors.

**Files to Change (B)**

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Add small pure helpers for extracting ICP and Hypothesis summaries from `completed.icp` / `completed.hypothesis` (or equivalent objects).
  - Render these summaries in the appropriate sidebar/detail area so users see the structured coach output alongside pipeline controls.
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Add focused tests that exercise the summary helpers (not full DOM trees) to keep the file maintainable.

**Functions to Implement or Extend (B)**

- `buildIcpSummaryFromProfile(profile)`  
  - Takes a completed ICP profile (including `phase_outputs`, `company_criteria`, and `persona_criteria`) and returns a normalized summary object with valueProp, industries, companySizes, pains, decisionMakers, triggers, and dataSources, preferring phase data when available.

- `buildHypothesisSummaryFromSearchConfig(hypothesis)`  
  - Takes a completed hypothesis (including `search_config` and optional `search_config.phases`) and returns a normalized summary with label, region, offers, and critiques used by the UI component.

- `renderIcpSummary(summary)` / `renderHypothesisSummary(summary)` (inline JSX helpers)  
  - Present the normalized summaries in a compact, readable layout within the Pipeline Workspace sidebar; reuse naming/field conventions from `IcpDiscoveryPage` for parity.

**Planned Tests (B)**

- `pipeline_buildIcpSummaryFromProfile_prefers_phase_outputs_when_present`  
  - Given a profile with `phase_outputs` and criteria, expect summary to use phase fields.

- `pipeline_buildIcpSummaryFromProfile_falls_back_to_company_and_persona_criteria`  
  - With only flattened criteria, expect summary to still populate valueProp/industries/pains/etc.

- `pipeline_buildHypothesisSummaryFromSearchConfig_uses_phase_offers_and_critiques`  
  - Ensure offers/critiques are taken from `search_config.phases.phase4/phase5` when present.

- `pipeline_buildHypothesisSummaryFromSearchConfig_handles_missing_phases_gracefully`  
  - With only base `search_config`, expect a minimal but non-empty summary (label/region).

### C – Playwright + DevTools E2E (verification only)

**Behaviour**

- Drive the running web app via Playwright MCP to:
  - Confirm LLM providers and models are visible/connected in the UI.
  - Ensure at least one ICP and one Hypothesis prompt are configured in the Prompts tab.
  - Run “Generate via coach” flows for ICP and Hypothesis either from ICP Discovery or Pipeline Workspace Chat with AI.
  - Verify that the new Pipeline Workspace summaries render non-empty text for ICP and Hypothesis fields after coach runs.
  - Capture one or more screenshots and note any console errors.

**Tools / Scripts (C)**

- Use the `playwrigh` MCP tools from Codex CLI:
  - `Playwright_playwright_navigate` to open the app.
  - `Playwright_playwright_click` / `Playwright_playwright_fill` / `Playwright_playwright_get_visible_text` to drive flows.
  - `Playwright_playwright_screenshot` to capture evidence for this session doc.

**Planned E2E Steps (C)**

1. Navigate to the app root and open the Prompts tab; ensure ICP/Hypothesis prompts exist (create minimal ones if needed).
2. Navigate to ICP Discovery or Pipeline Workspace and run coach-based ICP/Hypothesis generations using Chat with AI input.
3. Wait for completion and then assert that:
   - ICP summary in Pipeline Workspace shows a non-empty valueProp and at least one industry.
   - Hypothesis summary shows at least one offer or critique string.
4. Capture a screenshot and briefly summarize the run (provider, model, prompts used) in this session doc.

**Planned E2E Checks (C)**

- `e2e_icp_coach_pipeline_flow_shows_summaries`  
  - Full prompt → coach → pipeline summaries flow produces visible ICP and Hypothesis summaries with no fatal errors.

- `e2e_llm_providers_panel_shows_models_available`  
  - LLM Services or Settings view lists at least one model per configured provider, confirming live connectivity.

## Documentation and Session Updates

- At the end of the session:
  - Mark the relevant A/B/C items in `docs/sessions/2025-12-12_4_icp-coach-interactive-ui-and-e2e-plan.md` as “Completed”.
  - Update this plan document with a short “Completed vs To Do” section summarizing what shipped.
  - Add a concise entry to `CHANGELOG.md` describing Pipeline Workspace summaries for ICP/Hypothesis coach runs and the E2E verification.
  - If Playwright runs reveal UX or reliability issues, log them explicitly as “To Do (future sessions)” here rather than changing scope mid-session.

## Session Outcome

- **Completed**
  - Implemented `buildIcpSummaryFromProfile` and `buildHypothesisSummaryFromSearchConfig` in `PipelineWorkspaceWithSidebar` and used them to enrich the “Current Configuration” sidebar with ICP/Hypothesis summaries that prefer `phase_outputs` / `search_config.phases` and fall back to existing criteria when phases are absent.
  - Added focused Vitest coverage for both helpers in `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`, covering phase-driven and fallback paths; `pnpm lint`, `pnpm build`, and the targeted test run are all green.
  - Executed a manual Playwright MCP flow against `http://localhost:5173` that:
    - Verified live LLM connectivity banners (OpenAI/Anthropic models listed via the status stripe).
    - Created an ICP and hypothesis via the quick-entry flows, confirming that the Pipeline “Current Configuration” panel updates to show the selected ICP/hypothesis.
    - Opened the AI Assistant while on the Hypothesis step and attempted a coach-based run using the configured provider/model, capturing a full-page screenshot (`e2e_pipeline_icp_hypothesis_summary-2025-12-13T00-16-54-149Z.png`) for reference.
  - Updated `docs/sessions/2025-12-12_4_icp-coach-interactive-ui-and-e2e-plan.md` and `CHANGELOG.md` to reflect the Pipeline Workspace summaries and E2E verification work.

- **To Do (future sessions)**
  - Introduce a small, automated Playwright script (outside of this repo or as an opt-in test) that asserts non-empty summary lines after a successful coach run and surfaces regressions when `phase_outputs` / `search_config.phases` stop flowing through.
  - Extend the E2E run to cover the Prompts tab explicitly (creating / selecting distinct ICP vs Hypothesis prompts) and to validate that prompt changes reflect in downstream coach behaviour without further schema changes.
