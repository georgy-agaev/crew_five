# 2025-12-11 Session – Prompt Registry Step-less Implementation

> Timestamp: 2025-12-11T10:45:00

## Short Overview

We will finish the step-less Prompt Registry workflow so the Prompts tab is simple and fully functional: prompts are created without a `step` field, Task Configuration always shows the full list of prompts, and the backend uses the explicit prompt IDs selected in the UI for coach flows (ICP & Hypothesis) and draft generation. No extra mapping tables or legacy fallbacks will be added beyond what other callers already use.

## Scope (Only What We Need Now)

- Web UI should allow creating prompts, changing their rollout status, and selecting prompts per task (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message) without relying on a `step` column.
- Backend should accept these explicit prompt IDs and propagate them to coach jobs and draft metadata so analytics and logs use the configured prompts exactly.
- CLI and other existing callers keep their current behaviour; we will not add new prompt resolution paths.

## Files to Touch

- `web/src/apiClient.ts`
- `web/src/pages/PromptRegistryPage.tsx`
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
- `src/services/drafts.ts`
- `tests/drafts.test.ts`
- `CHANGELOG.md`

## Implementation Steps

1. **Simplify Prompt types and CRUD in the Web API client**  
   - Remove required `step` from the web-facing `PromptEntry` creation payload and stop using the `step` query parameter when fetching prompts from `/prompt-registry` for the Prompts tab.

2. **Update Prompts tab to create and list prompts without a Step field**  
   - Remove the Step dropdown from the create prompt form and rely on `id`, `version`, `description`, `rollout_status`, and optional `prompt_text`.  
   - Keep the registry table but remove mandatory `step` display and tolerate rows that do or do not have `step` set.

3. **Introduce per-task prompt selection in Task Configuration (front-end only)**  
   - Maintain a simple `taskPrompts` state object mapping each task key to a prompt ID.  
   - Build a flat list of prompt options from all `promptEntries` and use the same options for each task’s dropdown.

4. **Wire coach and draft calls to use explicit task selections**  
   - `handleAiSend` should pass the selected prompt ID for ICP and Hypothesis, and avoid calling `fetchActivePrompt` or relying on step-based resolution.  
   - `handleGenerateDrafts` should pass the email-draft prompt ID as `explicitCoachPromptId` and not depend on active prompts by step.

5. **Make `generateDrafts` prefer explicit prompt IDs over step resolution**  
   - When `explicitCoachPromptId` is provided, use it directly in metadata and skip calling `resolvePromptForStep`.  
   - When only `coachPromptStep` is provided (CLI or other callers), continue to resolve via `prompt_registry` as today.

6. **Run and extend tests, then update docs**  
   - Keep existing tests green, add focused tests for the new helpers and explicit prompt ID behaviour, then run `pnpm test` for the touched suites.  
   - Once behaviour is verified, record changes in `CHANGELOG.md` and keep this session doc in sync.

## Functions (with Roles)

- `getPromptOptions(entries: PromptEntry[])` (new, `PipelineWorkspaceWithSidebar.tsx`)  
  Builds a flat array of `{ value, label }` prompt options from all registry entries, ignoring any `step` values.

- `getTaskSelectionLabel(taskPrompts, taskKey)` (new, `PipelineWorkspaceWithSidebar.tsx`)  
  Returns the currently selected prompt ID for a given task key or a fallback like `null` for "None set" display.

- `handleAiSend` (existing, `PipelineWorkspaceWithSidebar.tsx`)  
  Uses `taskPrompts.icpDiscovery` or `taskPrompts.hypothesisGen` as `promptId` for coach ICP/Hypothesis calls, without consulting active prompts by step.

- `handleGenerateDrafts` (existing, `PipelineWorkspaceWithSidebar.tsx`)  
  Uses `taskPrompts.emailDraft` as `explicitCoachPromptId` for draft generation and stops relying on `fetchActivePrompt('draft')`.

- `buildPromptCreateEntry` (existing, `PipelineWorkspaceWithSidebar.tsx`)  
  Normalises the inline prompt create form payload; updated to omit `step` in the body sent from the Web UI while still tolerating a `step` value if present.

- `generateDrafts` (existing, `src/services/drafts.ts`)  
  Prefers `options.explicitCoachPromptId` when present; only calls `resolvePromptForStep` when a step is provided and no explicit ID is set.

## Tests (names and behaviours)

- `task_config_prompt_select_updates_taskPrompts_state` (`PipelineWorkspaceWithSidebar.test.ts`)  
  Selecting a prompt in Task Configuration updates the correct key in `taskPrompts`.

- `task_config_active_label_uses_taskPrompts_mapping` (`PipelineWorkspaceWithSidebar.test.ts`)  
  "Active prompt" label under each task reflects the selected prompt ID.

- `builds_prompt_options_from_all_entries` (`PipelineWorkspaceWithSidebar.test.ts`)  
  Helper builds options for every prompt entry, without step filtering.

- `icp_coach_uses_task_prompt_selection_when_present` (`PipelineWorkspaceWithSidebar.test.ts`)  
  ICP coach handler passes the selected prompt ID instead of fetching active prompts by step.

- `draft_generation_uses_task_prompt_selection_when_present` (`PipelineWorkspaceWithSidebar.test.ts`)  
  Draft generation helper passes the selected email draft prompt ID as `explicitCoachPromptId`.

- `draft_generation_uses_resolved_prompt_id_when_step_provided` (`tests/drafts.test.ts`)  
  When only a step is provided, `generateDrafts` still calls `resolvePromptForStep` and uses the resolved ID in metadata.

- `draft_generation_uses_explicit_prompt_id_when_provided` (`tests/drafts.test.ts`)  
  When `explicitCoachPromptId` is passed, `generateDrafts` uses that ID directly and does not call `resolvePromptForStep`.

## Outcomes (end of session)

- Web prompt creation no longer requires a `step` field: `PromptRegistryPage` and the inline Prompt Registry card both create prompts with `{ id, version, description, rollout_status, prompt_text }` only, and the API client’s `PromptEntry` type now treats `step` as optional.
- Task Configuration prompt dropdowns now show the same flat list of prompts for every task, with per-task selections stored in a new `taskPrompts` state object and surfaced via the "Active prompt" labels.
- ICP and Hypothesis coach flows read `promptId` from `taskPrompts` instead of `fetchActivePrompt(step)`, and the draft generation path passes `explicitCoachPromptId` from `taskPrompts.emailDraft` so Web flows never depend on registry step filters.
- `generateDrafts` now prefers an explicit prompt ID, only falling back to `resolvePromptForStep` when no explicit ID is supplied; tests cover both behaviours, and `pnpm build`, `pnpm lint`, and the full Vitest suite (minus existing CLI/socket-related failures) are green for the touched areas.
