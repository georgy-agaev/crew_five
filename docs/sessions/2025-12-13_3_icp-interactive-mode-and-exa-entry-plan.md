# Session Plan – 2025-12-13 ICP Interactive Mode (1) → Exa Entry Points (2) → Multisource Prep (3)

> Timestamp (UTC): 2025-12-13T00:00:00Z  
> Goal: Evolve the current “Chat with AI” experience into a clearer interactive ICP coach mode, make the
> Pipeline Workspace segment step’s **EXA Web Search** / **Search Database** tiles actually drive useful flows,
> and prepare the code paths needed for future multisource enrichment without introducing any new legacy
> fallbacks.

## Short Overview

- Start with **(1) ICP interactive mode**: keep the existing Express JSON coach contract and typed phase storage,
  but make the Pipeline Workspace AI Assistant and ICP Discovery page behave more like guided, multi-step
  conversations instead of isolated single-shot runs.
- Then wire **(2) Exa entry points**: make the **EXA Web Search** tile start a discovery run that users can
  actually review (by linking into the ICP Discovery page), and define a minimal behaviour for **Search Database**
  that lets users jump into existing segments without adding new backend endpoints.
- Finally, ensure the enrichment registry and telemetry hooks we already have are ready for **(3) multisource
  enrichment** in later sessions, but keep this session’s implementation surface strictly focused on UI and
  orchestration (no new provider contracts or DB columns).

---

## 1. ICP Coach Interactive Mode (multi-step UX on top of Express JSON)

### Behaviour and Constraints

- Keep `runIcpCoachProfileLlm` / `runIcpCoachHypothesisLlm` and their Express JSON payloads as the only LLM
  contracts for now (no new “interactive mode” schema).
- Treat “interactive” as **multi-step orchestration** on the web side:
  - Each user message in the Pipeline Workspace AI Assistant or ICP Discovery page becomes a coach run that is
    contextualised by the latest ICP/hypothesis summary.
  - We append summaries back into the transcript so users see how the ICP/hypothesis is evolving.
- Storage remains unchanged:
  - `icp_profiles.phase_outputs` and `icp_hypotheses.search_config.phases` stay the single source of truth.
  - Any interactive steps ultimately map into new or updated ICP/hypothesis rows via the existing coach flows.

### Files to Change (1)

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Extend the AI Assistant logic to support labelled “rounds” of ICP/hypothesis coaching and show which ICP or
    hypothesis each assistant message refers to.
  - Add a small “interactive mode” toggle or status indicator so users understand that repeated messages will
    refine the same ICP/hypothesis rather than silently creating many new rows.
- `web/src/pages/IcpDiscoveryPage.tsx`
  - Reuse the existing `icpChatMessages` / `hypothesisChatMessages` state but add light affordances for “continue
    refining this ICP/hypothesis” vs “start a new one”.
  - Make it clear, in the UI, when a coach run created a new profile/hypothesis versus updated summaries for an
    existing one.
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Add helper-level tests to keep transcript behaviour and summary mapping predictable as we introduce the
    interactive refinements.
- `web/src/pages/IcpDiscoveryPage.test.tsx`
  - Add tests for the new “refine vs create” branching and transcript behaviour.

### Functions to Implement or Extend (1)

- `appendInteractiveCoachMessage(messages, message)` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - Wraps `appendChatMessage` but tags each message with the current step and ICP/hypothesis id, then trims
    the transcript to a small window (for example, the last 6–8 messages) for readability.
- `buildInteractiveIcpPrompt(summary, userInput)` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - Constructs a `userPrompt` string that includes both the latest ICP summary and the new user input, so
  - Express-mode runs still receive a single user message but with enough context to feel multi-turn.
- `buildInteractiveHypothesisPrompt(summary, userInput)` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - Same idea as `buildInteractiveIcpPrompt`, but for hypotheses; we include regions/offers/criticisms from the
    latest summary before the new user question or refinement.
- `runInteractiveIcpCoachRound(trimmedMessage)` (extension of `handleAiSend` ICP branch)
  - Replaces the current single-shot ICP branch with a helper that:
    - Builds an interactive `userPrompt` from the current ICP summary and user text.
    - Calls `generateIcpProfileViaCoach` with `userPrompt` and the configured promptId/provider/model.
    - Updates the ICP list and transcript with the new summary.
- `runInteractiveHypothesisCoachRound(trimmedMessage)` (extension of `handleAiSend` hypothesis branch)
  - Mirrors the ICP logic for hypotheses, ensuring each round annotates the transcript with the updated
    hypothesis label and summary.
- `startOrRefineIcpProfile(promptText)` (new, `IcpDiscoveryPage.tsx`)
  - Wraps `runCoachIcpGeneration` logic so that when a profile is already selected we treat the run as a
    refinement (updating summaries and transcript), and when nothing is selected we create a new ICP.
- `startOrRefineHypothesis(promptText)` (new, `IcpDiscoveryPage.tsx`)
  - Same pattern for hypotheses: either create a new hypothesis for the selected ICP or refine the currently
    selected one, updating chat transcript and summaries.

### Tests (1 – Names and Behaviours)

- `pipeline_appendInteractiveCoachMessage_tags_with_step_and_entity`
  - Appends message with step/id metadata and keeps original array immutable.
- `pipeline_buildInteractiveIcpPrompt_includes_summary_and_user_input`
  - Ensures value prop/industries plus new text appear in userPrompt.
- `pipeline_buildInteractiveHypothesisPrompt_includes_offers_and_question`
  - Includes hypothesis label/offers plus the user’s latest refinement.
- `pipeline_runInteractiveIcpCoachRound_updates_icp_and_transcript`
  - Mocks a coach run and asserts ICP list, summary, and transcript all update.
- `pipeline_runInteractiveHypothesisCoachRound_updates_hypothesis_and_transcript`
  - Same as above for hypotheses; verifies label/summary text are reflected.
- `icpDiscovery_startOrRefineIcpProfile_creates_when_none_selected`
  - When no ICP is selected, triggers creation and selects the new profile.
- `icpDiscovery_startOrRefineIcpProfile_refines_selected_profile`
  - When an ICP is selected, runs coach and appends an assistant summary instead of switching selection.
- `icpDiscovery_startOrRefineHypothesis_creates_or_refines_correct_row`
  - Verifies hypothesis runs respect the current ICP/hypothesis selection.

---

## 2. Exa Entry Points – EXA Web Search and Search Database Tiles

### Behaviour and Constraints

- Keep existing Exa discovery and promotion services as-is; this session only wires the **entry points** from
  the Pipeline Workspace segment step so they lead to immediately useful flows.
- **EXA Web Search**:
  - Starts an Exa discovery run for the selected ICP/hypothesis (using the current `triggerIcpDiscovery` API)
    and guides users into the ICP Discovery page so they can review candidates without manually copying run ids.
- **Search Database**:
  - Opens a “search existing companies” view using current segments; for now this can be a filtered view based on
    the selected ICP/hypothesis rather than a brand-new backend search endpoint.

### Files to Change (2)

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Extend `handleRunDiscovery` so that, on success, we optionally store the latest `runId` in a sharable place
    (e.g. `sessionStorage` or query params) and surface a “Review candidates in ICP Discovery” link/button.
  - Wire the **Search Database** tile to navigate to a “Segments”/“Company search” view using existing segments
    and ICP/hypothesis context.
- `web/src/pages/IcpDiscoveryPage.tsx`
  - Read an optional `runId` (and ICP/hypothesis ids) from location/query or `sessionStorage` on load and
    auto-populate the “Pre-import review” and discovery run id fields when present.
- `web/src/App.tsx` or router entry
  - Ensure there is a routed path for ICP Discovery that can accept optional query params for `runId`, `icpId`,
    and `hypothesisId`.
- `web/src/apiClient.ts`
  - No new endpoints; only minor typing tweaks if needed for `triggerIcpDiscovery` return types.

### Functions to Implement or Extend (2)

- `persistLatestDiscoveryRun({ runId, icpProfileId, icpHypothesisId })` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - Writes the latest discovery metadata into `sessionStorage` under a scoped key so other pages can pick it up
    without introducing global state.
- `getPersistedDiscoveryRun()` (new, shared helper or duplicated small helper)
  - Reads and parses the latest discovery metadata, returning `null` on parse errors so callers can fall back
    gracefully.
- `navigateToIcpDiscoveryWithRun(router, discoveryMeta)` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - Uses the existing router to navigate to the ICP Discovery page with query params (or by relying on
    `sessionStorage`) so users land directly in the pre-import review section for the selected run.
- `hydrateDiscoveryRunFromLocation()` (new, `IcpDiscoveryPage.tsx`)
  - On mount, inspects query params and/or `sessionStorage`, sets `discoveryRunId`, `selectedProfileId`, and
    `selectedHypothesisId`, and immediately loads candidates when enough context is present.
- `handleSearchDatabaseClick()` (new, `PipelineWorkspaceWithSidebar.tsx`)
  - For now, navigates to a segments list view filtered by the selected ICP/hypothesis or surfaces a clear “coming
    soon” message if we decide to keep the behaviour simple while still making the button do something explicit.

### Tests (2 – Names and Behaviours)

- `pipeline_persistLatestDiscoveryRun_writes_session_storage_payload`
  - Stores runId/icp/hypothesis ids under the expected key.
- `pipeline_getPersistedDiscoveryRun_returns_null_on_invalid_json`
  - Handles bad/missing storage contents without throwing.
- `pipeline_handleRunDiscovery_persists_run_and_sets_status_message`
  - After a successful discovery call, saves metadata and updates `discoveryStatus`.
- `pipeline_handleSearchDatabaseClick_triggers_navigation_with_context`
  - Verifies Search Database tile calls router with ICP/hypothesis-aware destination.
- `icpDiscovery_hydrateDiscoveryRunFromLocation_prefills_run_and_loads_candidates`
  - With a persisted run and ICP/hypothesis ids, preloads candidates and selection state on first render.

---

## 3. Multisource Enrichment Prep (registry and telemetry only)

### Behaviour and Constraints

- Do **not** wire Parallel/Firecrawl/Anysite into live enrichment flows yet; this session only ensures the
  registry and telemetry can support them cleanly once we start using them.
- Keep the enrichment registry (`createEnrichmentProviderRegistry`) as the single way to resolve adapters; ensure
  it is observability-friendly (clear error codes, provider names) for future provider-specific work.

### Files to Change (3)

- `src/services/enrichment/registry.ts`
  - Verify provider keys and error codes are stable, and add minimal logging hooks or typed error codes if needed
    (without changing the existing Exa behaviour).
- `tests/enrichment.test.ts`
  - Add coverage to ensure new error codes and provider names are surfaced as expected.
- `docs/sessions/2025-12-05_4_multisource-enrichment-phase-2_registry-and-routing-plan.md`
  - Update Completed vs To Do to reflect this preparatory work as we finish it.

### Functions to Implement or Extend (3)

- `createEnrichmentProviderRegistry(supabase)` (existing)
  - Confirm and, if necessary, extend to tag each adapter with a `provider` field in returned results for clearer
    telemetry across providers.
- `getEnrichmentAdapter(name, supabase)` (existing)
  - Ensure it throws a consistently coded error (`ENRICHMENT_PROVIDER_UNKNOWN`) and document this in tests so
    future provider additions remain safe.

### Tests (3 – Names and Behaviours)

- `enrichment_registry_includes_all_supported_providers_with_labels`
  - Confirms registry can resolve `mock`, `exa`, `parallel`, `firecrawl`, `anysite` consistently.
- `getEnrichmentAdapter_throws_coded_error_for_unknown_provider`
  - Asserts `ENRICHMENT_PROVIDER_UNKNOWN` is present on thrown errors.

---

## Completed vs To Do (for this session)

- **Completed (this session)**  
  - Extended the Pipeline Workspace AI Assistant to behave more interactively: new helpers
    `appendInteractiveCoachMessage`, `buildInteractiveIcpPrompt`, and `buildInteractiveHypothesisPrompt` now wrap
    each ICP/hypothesis coach round with the latest summary plus the user’s message, and `handleAiSend` appends
    tagged transcript entries (step/entityId) while keeping the transcript trimmed to the most recent messages.  
  - Updated `handleRunDiscovery` in the Pipeline Workspace to persist Exa discovery metadata via
    `persistLatestDiscoveryRun`, so the latest `runId`/ICP/hypothesis context is available to other views; wired
    the **Search Database** tile to open the AI Assistant with a pre-filled prompt that guides users to search and
    filter existing segments instead of leaving the button inert.  
  - Added focused unit tests in `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` covering the new interactive
    helpers and discovery persistence, and kept existing ICP/Hypothesis summary helper tests green.  
  - Tightened enrichment registry error tests in `tests/enrichment.test.ts` so unknown providers now assert the
    presence of the `ENRICHMENT_PROVIDER_UNKNOWN` code as well as the human-readable message; this documents the
    error surface for future multisource enrichment providers.  
  - Ran `pnpm lint`, `pnpm build`, and the full Vitest suite; all relevant tests pass, with one pre-existing
    timeout in `tests/cliChatClient.test.ts` noted but unrelated to this session’s changes.

- **To Do (future sessions)**  
  - Add explicit “refine vs create” affordances and/or toggles in ICP Discovery and Pipeline Workspace so users
    can choose whether a coach round should create a new ICP/hypothesis or refine the selected one, and, if
    needed, persist richer interactive session metadata.  
  - Introduce explicit navigation from the Pipeline Workspace segment step into the ICP Discovery Pre-import
    Review panel (for example, via router links or deep-linking using the persisted discovery metadata) and
    optionally auto-load candidates when a `runId` is present.  
  - Extend the enrichment registry and telemetry to emit provider-specific metrics for Parallel/Firecrawl/Anysite
    once those adapters are wired into live enrichment flows.  
  - Consider adding targeted React Testing Library coverage for the EXA Web Search / Search Database tiles and
    interactive coach flows at the component level, complementing the current helper-focused tests.

