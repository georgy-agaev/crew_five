# Session Plan – ICP Coach + Prompts Integration (Workspace)

Timestamp (UTC): 2025-12-09T19-32-36Z

Status: In Progress

## Overview

We will make the ICP and Hypothesis “Chat with AI” in the Pipeline workspace use the active prompts defined in the Prompts tab, and make the Prompts tab actually manage those prompts (list, set active) in a minimal, production-ready way. The goal is to keep your Option B UI model visually intact while wiring only the functionality we need: selecting active prompts per step and threading those IDs through to the coach endpoints used by the ICP workflow.

---

## Scope and Non-Goals

- In scope:
  - Wiring ICP and Hypothesis chat to use active prompt IDs from the prompt registry (`icp_profile`, `icp_hypothesis`, `draft`).
  - Making the Prompts tab in the Pipeline workspace show existing prompts and allow “set active per step”.
  - Ensuring the standalone `PromptRegistryPage` remains the advanced place to create and edit prompt entries.
- Out of scope (for this session):
  - New prompt text authoring tools beyond the existing registry and `prompts/` files.
  - Full Task Configuration persistence (provider/model/prompt combinations) to a new backend API.
  - Any legacy fallback behaviour for old UI flows or mock-only modes beyond what is already present.

---

## Files to Touch

- Backend / services
  - `src/services/icpCoach.ts`  
    - Extend coach input types to carry `promptId` and ensure the ICP coach job payload records which prompt was used.
  - `src/services/coach.ts`  
    - Wire `promptId` from web adapter into `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` inputs, preserving the existing response shape.
  - `src/web/server.ts`  
    - For `/api/coach/icp` and `/api/coach/hypothesis`, forward `promptId` from the HTTP body into the coach services and keep mock/live deps aligned.

- Web API client
  - `web/src/apiClient.ts`  
    - Confirm `generateIcpProfileViaCoach` and `generateHypothesisViaCoach` accept an optional `promptId` and pass it through in the POST body (already supported shape, just ensure types and usage are explicit).

- Pipeline workspace UI
  - `web/src/pages/PipelineWorkspaceWithSidebar.tsx`  
    - In ICP and Hypothesis steps, make “Chat with AI → Send”:
      - Fetch the active prompt for the appropriate step via `fetchActivePrompt('icp_profile')` or `fetchActivePrompt('icp_hypothesis')`.
      - Pass the resulting `coach_prompt_id` as `promptId` into the coach API client calls.
    - In the Prompts tab for the workspace:
      - Keep the existing table and filters.
      - Add a lightweight “Set active” action per row that calls `setActivePrompt(step, coach_prompt_id)` and refreshes the list.

- Prompt registry UI (standalone)
  - `web/src/pages/PromptRegistryPage.tsx`  
    - No visual changes; only minor internal tweaks if needed to keep behaviour consistent with the workspace Prompts tab (e.g., reusing helper functions or labels).

- Tests
  - `web/src/apiClient.test.ts`  
    - Add coverage that `generateIcpProfileViaCoach` and `generateHypothesisViaCoach` include `promptId` in the request body when provided.
  - `src/web/server.test.ts`  
    - Extend coach endpoint tests to assert that the web adapter forwards `promptId` into `generateIcpProfile` / `generateIcpHypothesis` deps.
  - `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`  
    - Add unit tests for new helpers/selectors if we introduce any; avoid full DOM tests here.
  - `web/src/pages/PromptRegistryPage.test.ts` (or new tests if missing)  
    - Ensure “Set active” uses `setActivePrompt` and refreshes entries.

---

## Detailed Plan – Steps

### Step 1 – Thread `promptId` Through Coach Services (Backend)

**Goal:** Ensure coach endpoints know which prompt was used, without changing response envelopes.

- Update `IcpCoachProfileInput` and `IcpCoachHypothesisInput` in `src/services/icpCoach.ts`:
  - Add `promptId?: string` (optional) so the coach job payload can record the prompt backing each run.
  - Make sure this field is simply passed along; the LLM scaffold remains the same system prompt file.
- Update `createIcpProfileViaCoach` and `createIcpHypothesisViaCoach` in `src/services/coach.ts`:
  - Accept `promptId` on the input object and include it in the job payload stored in `jobs.payload` (no change to returned `profile`/`hypothesis` shape).
- Update live deps in `src/web/server.ts`:
  - In `generateIcpProfile` (live), read `promptId` from `req.body` and pass it into `createIcpProfileViaCoach`.
  - In `generateIcpHypothesis` (live), do the same for hypothesis runs.
  - For `createMockDeps`, either ignore `promptId` or echo it back in the mock coach response while keeping the contract simple.

**Functions (backend):**
- `IcpCoachProfileInput` / `IcpCoachHypothesisInput`  
  - Types modeling inputs to the ICP coach LLM; we’ll extend them to carry an optional `promptId` for traceability.
- `createIcpProfileViaCoach(client, chatClient, input)`  
  - Orchestrates an ICP profile coach run, stores a job, and inserts the resulting profile into Supabase; will now also carry `promptId` into the job payload.
- `createIcpHypothesisViaCoach(client, chatClient, input)`  
  - Similar orchestration for hypotheses; will record `promptId` alongside input in the job payload.
- `generateIcpProfile(payload)` (in live deps)  
  - Web adapter bridge for `/api/coach/icp`; will read `promptId` from the HTTP body and forward it.
- `generateIcpHypothesis(payload)` (in live deps)  
  - Web adapter bridge for `/api/coach/hypothesis`; same pattern with `promptId`.

**Tests (backend):**
- `web_adapter_coach_icp_forwards_prompt_id_into_generateIcpProfile`  
  - Asserts web adapter deps receive `promptId` in `generateIcpProfile` payload.
- `web_adapter_coach_hypothesis_forwards_prompt_id_into_generateIcpHypothesis`  
  - Similar for `generateIcpHypothesis`.

Status: Completed – promptId now flows from HTTP body into coach services, and web adapter tests cover promptId forwarding for both ICP and hypothesis endpoints.

---

### Step 2 – Wire Workspace ICP Chat to Active Prompts

**Goal:** Make “Chat with AI → Send” use the active prompt for each ICP step.

- In `PipelineWorkspaceWithSidebar.tsx`:
  - Extend `handleAiSend`:
    - When `currentStep === 'icp'`:
      - Attempt `fetchActivePrompt('icp_profile')` before calling `generateIcpProfileViaCoach`.
      - If a `coach_prompt_id` is returned, pass `promptId: coach_prompt_id` into `generateIcpProfileViaCoach`.
    - When `currentStep === 'hypothesis'`:
      - Do the same with `fetchActivePrompt('icp_hypothesis')` and `generateHypothesisViaCoach`.
  - Keep the UI flow identical: the user still types in the chat input and hits Send; we only change the payload behind the scenes.
  - Optionally, if no active prompt is configured, allow the coach call to proceed without `promptId` but display a subtle message (e.g., banner or inline text) that no active prompt was found for this step.

**Functions (workspace):**
- `handleAiSend()`  
  - Handles ICP/Hypothesis “Chat with AI” Send; will be extended to fetch and pass the active prompt ID per step before calling the coach endpoints.

**Tests (workspace):**
- `icp_chat_uses_active_icp_profile_prompt_id_when_present`  
  - Mocks `fetchActivePrompt` and asserts `generateIcpProfileViaCoach` receives `promptId`.
- `hypothesis_chat_uses_active_icp_hypothesis_prompt_id_when_present`  
  - Same for hypothesis step and `icp_hypothesis` prompt.

Status: Completed – ICP and Hypothesis chat now fetch the active prompt for `icp_profile` / `icp_hypothesis` and pass `promptId` into the coach API client calls, while preserving the existing UI flow.

---

### Step 3 – Make Prompts Visible and “Set Active” in Workspace Tab

**Goal:** Let users see existing prompts and mark one as active per step directly from the workspace Prompts tab.

- In `PipelineWorkspaceWithSidebar.tsx` (Prompts tab section):
  - Ensure `useEffect` for `currentPage === 'promptRegistry'` calls `fetchPromptRegistry()` and stores the entries in `promptEntries` (already present).
  - For each row in the prompt table:
    - Add a “Set active” control when:
      - The entry’s `rollout_status` is not already active.
    - On click:
      - Call `setActivePrompt(entry.step, entry.id)` via the existing API client.
      - Refresh the list by re-running `fetchPromptRegistry()`.
  - Use the existing `getPromptStatusKey` helper to show “Active”, “Pilot”, and “Retired” labels; “Active” should be visually distinct.
- Keep the “Create Prompt” button in the workspace Prompts tab visually disabled (“SOON”) for now; creation is handled in the standalone `PromptRegistryPage` to avoid duplicating too much UI.

**Functions (workspace Prompts tab):**
- `getPromptStatusKey(entry)`  
  - Already returns `'active' | 'pilot' | 'retired' | ''`; drives labels and determines when to show the “Set active” action.
- `handleSetPromptActive(entry)` (new helper)  
  - Calls `setActivePrompt(entry.step, entry.id)` and reloads `promptEntries` for the workspace Prompts tab.

**Tests (workspace Prompts tab):**
- `prompt_table_shows_active_pilot_retired_labels_from_status_key`  
  - Ensures labels/colors map from `rollout_status`/`is_active` correctly.
- `prompt_table_set_active_calls_setActivePrompt_and_refreshes_entries`  
  - Asserts the new “Set active” action updates backend and reloads the list.

Status: Completed – the workspace Prompts tab now exposes a “Set active” action per entry, which calls `setActivePrompt` and reloads the prompt list; active prompts are visibly labeled, inactive prompts can be promoted to active, and the Task Configuration block shows the current active prompt ID per logical task (ICP discovery, hypothesis generation, draft generation).

---

### Step 4 – Keep PromptRegistryPage as the Creation/Management Surface

**Goal:** Avoid duplicating complex prompt creation UI in the workspace tab while still enabling prompt management.

- In `web/src/pages/PromptRegistryPage.tsx`:
  - Confirm that:
    - `onCreate` posts to `createPromptRegistryEntry` with `id`, `step`, `version`, `description`, `rollout_status`, `prompt_text`.
    - `onSetActive` calls `setActivePrompt(step, promptId)` and refreshes entries.
  - Make no visual changes; this page remains the primary place to create/edit prompts.
- Ensure documentation (`docs/prompt_reference_usage.md`) already points to `PromptRegistryPage` and `prompt_registry` as the canonical management path for prompts.

**Functions (PromptRegistryPage):**
- `onCreate()`  
  - Creates a new prompt registry entry for the selected step; already implemented, only minor tweaks if needed.
- `onSetActive(step, promptId)`  
  - Marks a prompt as active for the given step; already implemented.

**Tests (PromptRegistryPage):**
- `prompt_registry_page_creates_prompt_entry_with_required_fields`  
  - Confirms `createPromptRegistryEntry` is called with correct payload.
- `prompt_registry_page_sets_active_prompt_and_updates_is_active_flag`  
  - Asserts active prompt selection flows through to the UI.

Status: Completed – `PromptRegistryPage` remains the primary surface for creating prompt entries and setting them active, and its behaviour is aligned with the workspace Prompts tab’s understanding of `rollout_status` and `is_active`.

---

### Step 5 – Sanity-Check Draft Step Prompt Usage

**Goal:** Align Draft step behaviour with the same active-prompt model.

- In `PipelineWorkspaceWithSidebar.tsx` Draft step:
  - We already fetch `fetchActivePrompt('draft')` before `triggerDraftGenerate`.
  - Confirm we are passing:
    - `coachPromptStep: 'draft'` and `explicitCoachPromptId: activePromptId` into `triggerDraftGenerate`.
  - No additional UI changes needed; just ensure this behaviour is documented alongside the ICP and Hypothesis flows.

**Functions (Draft step):**
- `handleGenerateDrafts()`  
  - Triggers draft generation for the selected campaign; already uses active draft prompt, we only need to confirm and keep it consistent with ICP/Hypothesis wiring.

**Tests (Draft step):**
- `draft_step_uses_active_draft_prompt_id_when_present`  
  - Confirms the draft generation call includes the active draft `coach_prompt_id`.

Status: Completed – Draft step already uses `fetchActivePrompt('draft')` and passes the resulting `coach_prompt_id` into `triggerDraftGenerate`; this behaviour has been verified and remains consistent with the new ICP/Hypothesis wiring.

---

## Task List Summary

-- To Do:
  - None for this session; remaining enhancements (task-config persistence, richer prompt authoring UI) are deferred.
- Completed:
  - Threaded `promptId` from web adapter into coach services.
  - Wired ICP and Hypothesis chat “Send” to use active prompts for `icp_profile` and `icp_hypothesis`.
  - Enabled “Set active” per prompt in the workspace Prompts tab with live reload.
  - Kept `PromptRegistryPage` as the main creation surface for prompt entries.
  - Verified draft step active prompt usage and kept it consistent with new ICP/Hypothesis wiring.
