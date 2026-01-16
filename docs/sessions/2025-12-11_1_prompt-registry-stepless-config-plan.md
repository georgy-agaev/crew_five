# 2025-12-11 Session – Step-less Prompt Registry & Task Configuration

> Timestamp: 2025-12-11T09:50:00

## Short Overview

We will simplify the Prompts system so it no longer depends on a `step` column in Supabase. The Prompts tab will manage a single flat list of prompts, and Task Configuration will let you pick any prompt for each task (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message). Those explicit selections will be passed straight into the backend for coach and draft flows, so the prompts you see and configure in the Prompts tab are exactly what the backend uses—without step-based resolution or hidden fallbacks.

## Goals (this session)

- Remove `step` as a required field in the Web UI prompt create forms and from the API client contract where possible.
- Make Task Configuration prompt dropdowns show all prompts (not filtered by step) and persist a per-task selection in the frontend.
- Ensure coach and draft backend calls use the Task Configuration selections directly (explicit prompt IDs), without relying on `step`-based active prompt resolution.
- Keep `prompt_registry` as a single table with statuses only (Pilot/Active/Retired), and leave CLI or other consumers unaffected as much as possible.

## Files to Change

- `web/src/pages/PromptRegistryPage.tsx`
  - Remove the Step field from the create prompt form and any logic that uses `PromptStep` there.
  - Adjust the table header and row rendering to not rely on `entry.step`.

- `web/src/apiClient.ts`
  - Make `createPromptRegistryEntry` accept prompts without `step` (parameter optional or removed) and update its type signature.
  - Stop using the `step` query parameter for `fetchPromptRegistry` in the Web UI path (always fetch all prompts for the Prompts tab and Task Configuration).

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Replace step-based filtering/mapping in Task Configuration with a flat prompt list.
  - Introduce per-task prompt selection state and wire Task Configuration dropdowns to that state.
  - Update ICP/Hypothesis coach and Draft generation handlers to use the per-task selection directly instead of `fetchActivePrompt(step)`.
  - Keep the Prompt Registry table working (statuses, Set active) but decouple it from Task Configuration.

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Update helper tests to reflect step-less prompt option building and per-task selection helpers.

- `src/services/promptRegistry.ts` (minimal)
  - Verify that `resolvePromptForStep` respects explicit IDs without additional transformations; adjust only if we find unnecessary fallback logic for the Web UI use cases.

- `src/web/server.ts` (minimal)
  - Confirm `/api/prompt-registry` behaviour is compatible with fetching all prompts and no longer relying on `step` filters for the Web UI.

## Implementation Plan (only the functionality we need now)

### 1) Simplify prompt creation and listing (no step input)

**What we will do**
- Treat `prompt_registry` as a flat list: prompts have `id`, `version`, `description`, `rollout_status`, `prompt_text`, but no step selection in the UI.
- The Prompts tab will show all prompts in a single table and use the same list for Task Configuration.

**Files**
- `web/src/pages/PromptRegistryPage.tsx`
- `web/src/apiClient.ts`

**Functions (new or adjusted)**

- `createPromptRegistryEntry(entry)` (apiClient – adjusted)
  - Accepts `{ id, version, description, rollout_status, prompt_text }` (no `step`) and posts to `/prompt-registry`.
  - Used by both the Prompt Registry page and the inline create form in the workspace.

- `fetchPromptRegistry()` (apiClient – adjusted)
  - Fetches all prompts from `/prompt-registry` without a `step` query parameter; the Web UI will filter or group purely on the client if needed.

**Tests to add/update**

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - _"builds prompt options from all entries"_ – options builder includes all prompts, not filtered by step.

- (Optional) `web/src/pages/PromptRegistryPage.test.ts`
  - _"create form omits step field and still saves"_ – form submission sends payload without `step` and creates a prompt.

### 2) Per-task prompt selection in Task Configuration

**What we will do**
- Introduce a simple per-task mapping in the React state (front-end only) that records which prompt ID is selected for each task.
- Task Configuration dropdowns will show all prompts (e.g., by ID and version) and store the selection there.
- The "Active prompt" label under each task will read from this mapping instead of `step`-based registry logic.

**Files**
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`

**Functions (new or adjusted)**

- `getPromptOptions(entries: PromptEntry[])` (new helper)
  - Builds `{ value: id, label: "id (version)" }` options from the full prompt list, ignoring step.

- `getTaskSelectionLabel(taskPrompts, taskKey)` (new helper)
  - Given `taskPrompts` state and a task key (`'icpDiscovery' | 'hypothesisGen' | 'emailDraft' | 'linkedinMsg'`), returns the selected prompt ID or `null` for display in "Active prompt: …".

- `PipelineWorkspaceWithSidebar` component – Task Configuration state (new)
  - `const [taskPrompts, setTaskPrompts] = useState<{ icpDiscovery?: string; hypothesisGen?: string; emailDraft?: string; linkedinMsg?: string }>({});`
  - Change handlers on each Task Configuration prompt `<select>` will set `taskPrompts[task]` to the selected id.

**Tests to add/update**

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - _"task_config_prompt_select_updates_taskPrompts_state"_ – selecting a prompt for a task updates the mapping.
  - _"task_config_active_label_uses_taskPrompts_mapping"_ – "Active prompt: …" under each task shows the selected id.

### 3) Make backend usage rely on explicit task selections

**What we will do**
- Stop using `fetchActivePrompt(step)` in the Web UI; instead, pass the Task Configuration selection directly into backend calls as an explicit prompt id.
- For ICP and Hypothesis coach flows, send `promptId` from `taskPrompts`.
- For Draft generation, send `explicitCoachPromptId` from `taskPrompts.emailDraft`.

**Files**
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
- `web/src/apiClient.ts` (no functional changes here, but confirm shapes)
- `src/web/server.ts` (confirm existing coach and drafts endpoints already respect explicit prompt IDs)
- `src/services/promptRegistry.ts` (inspect only)

**Functions (new or adjusted)**

- `handleAiSend` (component function – adjusted)
  - For `currentStep === 'icp'`, use `taskPrompts.icpDiscovery` as `promptId` when calling `generateIcpProfileViaCoach`, without fetching active prompt by step.
  - For `currentStep === 'hypothesis'`, use `taskPrompts.hypothesisGen` similarly.

- `handleGenerateDrafts` (component function – adjusted)
  - Uses `taskPrompts.emailDraft` as `explicitCoachPromptId` when calling `triggerDraftGenerate` so draft generation uses the prompt configured in Task Configuration.

- `resolvePromptForStep(client, params)` (service – inspected only)
  - Ensure that when `params.explicitId` is provided, it is used as-is and no additional step-based lookup is performed for Web UI flows.

**Tests to add/update**

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - _"icp_coach_uses_task_prompt_selection_when_present"_ – helper-level test that when a task prompt id exists, it is passed down to `generateIcpProfileViaCoach` instead of using an active prompt lookup.
  - _"draft_generation_uses_task_prompt_selection_when_present"_ – verifies that the selected email draft prompt id is used as `explicitCoachPromptId`.

- (Optional) `src/web/server.test.ts`
  - _"coach_endpoints_honor_explicit_promptId_without_step_lookup"_ – existing tests likely already assert this, but add one if needed.

### 4) Keep Prompt Registry table usable without step

**What we will do**
- Maintain the ability to change `rollout_status` (Pilot/Active/Retired) and show status chips in the registry table.
- Keep the "Set active" button wired to the existing `/api/prompt-registry/active` route for users who want a global "active" prompt, but treat Task Configuration selections as primary for the Web UI flows.

**Files**
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
- `web/src/apiClient.ts`

**Functions (existing)**

- `getPromptStatusKey(entry)`
  - Continues to map `rollout_status` to display status used by both the registry table and any optional global view.

- `setActivePrompt(step, coachPromptId)` / `/api/prompt-registry/active`
  - Left as-is to avoid breaking CLI or future flows; not used by Task Configuration once explicit selections are in place.

**Tests to keep**

- Existing tests around status mapping and Prompt Registry helper behaviour remain valid and help guard against regressions.

---

This plan keeps the system simple and aligns with your preference:
- No `step` field to manage in the database.
- A single flat list of prompts.
- Per-task prompt choice is made in the Prompts tab’s Task Configuration and sent directly to the backend for actual work.
- Step-based active prompt resolution remains only as a compatibility path for existing code but is no longer the primary path for your Web workflow.