# Session Plan – Prompt Management Phase B (Active Selection & Resolution)

Timestamp (UTC): 2025-12-04T18-02-12Z

## Overview

This session focuses on **Phase B** of prompt management: adding “active prompt per step” selection and a single shared resolution path that both draft generation and coach flows use. We will reuse the existing prompt registry table and UI, introduce minimal helper APIs for setting/reading the active prompt, and wire `coach_prompt_id` resolution into draft services (and optionally coach flows). We allow a small, targeted schema adjustment to keep `rollout_status` values and columns aligned with current usage, but no new tables or legacy fallback paths; we only implement the core functionality needed to select and resolve prompts for current steps (`icp_profile`, `icp_hypothesis`, `draft`).

---

## Scope (Files to Touch)

- **Backend / Services**
  - `src/services/promptRegistry.ts`
    - Extend to support active prompt selection and resolution.
  - `src/services/coach.ts`
    - Use resolved `coach_prompt_id` when orchestrating ICP coach flows (where appropriate).
  - `src/services/drafts.ts`
    - Use resolved `coach_prompt_id` when generating email drafts; keep metadata building centralized.
- **Web Adapter / API**
  - `src/web/server.ts`
    - Add small HTTP endpoints for reading active prompts per step and updating the active prompt.
- **Web API Client / UI**
  - `web/src/apiClient.ts`
    - Add `fetchActivePrompt(step)`, `setActivePrompt(step, id)`, and optionally `fetchPromptRegistry(step?)` helper variations.
  - `web/src/pages/PromptRegistryPage.tsx`
    - Add UI controls to mark an entry active per step and display which prompt is currently active.
  - `web/src/pages/PromptRegistryPage.test.tsx`
    - Exercise active selection controls and visual state.

We will keep schema changes to a minimum. If needed, we may add missing `step`/status support to `prompt_registry` via a small migration, but we will not introduce new tables or unrelated columns.

---

## Implementation Plan (Step-by-Step)

### Step 1 – Define “Active Prompt per Step” Semantics

**Goal:** Decide what “active prompt” means and align semantics with existing usage.

- Use `prompt_registry.rollout_status` per `step` as the active marker:
  - Exactly one entry per `step` should have `rollout_status = 'active'`.
  - Other entries for that step may be `pilot`, `retired`, or `deprecated` (we will align the DB constraint with these values).
- Define resolution rule:
  1. If an explicit `coach_prompt_id` is provided (from CLI or UI), use it.
  2. Else, use the `prompt_registry` entry with `rollout_status = 'active'` for that `step`.
  3. If none exists, fail fast with an explicit error (`PROMPT_NOT_CONFIGURED`).

### Step 2 – Extend `promptRegistry` Service with Resolution Helpers

**Goal:** Centralize active selection/resolution logic in a single service.

- In `src/services/promptRegistry.ts`, add:
  - `getActivePromptForStep(client, step: string): Promise<string | null>`
    - Queries `prompt_registry` for entries with `step` and `rollout_status = 'active'`, returns `coach_prompt_id` or `null` if none.
  - `setActivePromptForStep(client, step: string, coachPromptId: string): Promise<void>`
    - Sets `rollout_status = 'active'` for the given `step` and `coach_prompt_id`.
    - Sets `rollout_status = 'pilot'` (or keeps existing) for all other entries of that `step`.
  - `resolvePromptForStep(client, params: { step: string; explicitId?: string }): Promise<string>`
    - Implements the resolution rule (explicit → active → error).

### Step 3 – Wire Resolution into Draft Generation

**Goal:** Ensure `generateDrafts` uses `resolvePromptForStep` to set `coach_prompt_id` when available.

-- In `src/services/drafts.ts`:
  - Extend `GenerateDraftsOptions` to accept `coachPromptStep?: string` and `explicitCoachPromptId?: string`.
  - At the start of `generateDrafts`, resolve the effective `coach_prompt_id` **once per call**:
    - If `coachPromptStep` is provided, call `resolvePromptForStep(client, { step: coachPromptStep, explicitId: explicitCoachPromptId })` and reuse the result for all members.
  - When building `metadata`, ensure:
    - `metadata.coach_prompt_id` is set to the resolved prompt id.
    - `metadata.draft_pattern` continues to be derived from `coach_prompt_id`, `pattern_mode`, and `variant`.
  - If resolution fails (no active prompt), throw a user-facing error with a clear message.

### Step 4 – Wire Resolution into Coach-Orchestrated Flows (Optional but Recommended)

**Goal:** Allow ICP coach flows to tag created profiles/hypotheses with a `coach_prompt_id` when applicable.

- In `src/services/coach.ts`:
  - Optionally extend ICP coach orchestration functions (`createIcpProfileViaCoach`, `createIcpHypothesisViaCoach`) with optional `coachPromptStep` / `explicitCoachPromptId` parameters.
  - Resolve `coach_prompt_id` using the same `resolvePromptForStep` helper when these parameters are provided.
  - Store the resolved `coach_prompt_id` in a consistent metadata location if needed (e.g. in `icp_profiles` / `icp_hypotheses` metadata JSON in the future); for this phase, resolution may be used purely for tagging or logging.

### Step 5 – Add HTTP Endpoints for Active Prompt Management

**Goal:** Provide minimal HTTP APIs the Web UI can use to view and set active prompts, with `PromptRegistryPage` as the primary prompt-management UI.

- In `src/web/server.ts`, extend `dispatch` to handle:
  - `GET /api/prompt-registry?step=<step>`:
    - Returns prompt registry entries for the step, each annotated with whether it is active.
  - `GET /api/prompt-registry/active?step=<step>`:
    - Returns `{ step, coach_prompt_id: string | null }` using `getActivePromptForStep`.
  - `POST /api/prompt-registry/active`:
    - Accepts JSON `{ step: string; coach_prompt_id: string }`.
    - Calls `setActivePromptForStep` and returns `{ ok: true }` on success.
- Adjust `AdapterDeps` and `createLiveDeps` to provide `getActivePromptForStep` and `setActivePromptForStep` implementations based on `promptRegistry` service.

### Step 6 – Extend Web API Client and Prompt Registry Page

**Goal:** Surface active prompt selection in the Web UI.

- In `web/src/apiClient.ts`, add:
  - `fetchActivePrompt(step: string): Promise<{ step: string; coach_prompt_id: string | null }>`
    - GET `/prompt-registry/active?step=...`.
  - `setActivePrompt(step: string, coachPromptId: string): Promise<void>`
    - POST `/prompt-registry/active` with `{ step, coach_prompt_id }`.
- In `web/src/pages/PromptRegistryPage.tsx`:
  - Load active prompt per step on mount (`useEffect` + `fetchActivePrompt`).
  - In the entries list, display which entry is active (e.g. badge “Active”).
  - Add a “Set active” button per entry:
    - Calls `setActivePrompt(step, entry.coach_prompt_id)` and refreshes the list/active state.

### Step 7 – Tests and Validation

**Goal:** Validate behaviour end-to-end while keeping tests focused.

- Service-level tests:
  - `tests/promptRegistry.test.ts` (added)
    - Cover `getActivePromptForStep`, `setActivePromptForStep`, and `resolvePromptForStep`.
- Adapter/API tests:
  - Extend `src/web/server.test.ts`:
    - Verify `GET /api/prompt-registry/active` and `POST /api/prompt-registry/active` behaviour, including error paths.
- UI tests:
  - Extend `web/src/pages/PromptRegistryPage.test.tsx`:
    - Assert that active entries show the correct badge and that clicking “Set active” triggers the correct API calls.

---

## Function Inventory (New / Updated)

### `src/services/promptRegistry.ts`

- `getActivePromptForStep(client, step: string): Promise<string | null>`
  - Returns the `coach_prompt_id` of the prompt_registry entry with `rollout_status = 'active'` for the given step, or `null` if none exists.

- `setActivePromptForStep(client, step: string, coachPromptId: string): Promise<void>`
  - Marks the given `coach_prompt_id` as `active` for the step and demotes other entries for that step to non-active (e.g. `pilot`).

- `resolvePromptForStep(client, params: { step: string; explicitId?: string }): Promise<string>`
  - Returns `explicitId` if provided; otherwise looks up the active prompt for the step; throws a descriptive error if none is configured.

### `src/services/drafts.ts`

- `generateDrafts` (update)
  - Accepts optional `coachPromptStep` and `explicitCoachPromptId` parameters, uses `resolvePromptForStep` to determine the effective `coach_prompt_id`, and stores it in draft metadata alongside `draft_pattern`.

### `src/services/coach.ts`

- `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` (update)
  - May accept optional prompt selection parameters and, when present, resolve and thread `coach_prompt_id` into any relevant metadata or logs (without changing current schema).

### `web/src/apiClient.ts`

- `fetchActivePrompt(step: string)`
  - Fetches the current active prompt for a step from `/prompt-registry/active`.

- `setActivePrompt(step: string, coachPromptId: string)`
  - Sets the active prompt for a step via POST to `/prompt-registry/active`.

### `web/src/pages/PromptRegistryPage.tsx`

- Active prompt badge + “Set active” button (update)
  - Uses `fetchActivePrompt` to display current active entries and `setActivePrompt` to update them per step, keeping the UI in sync with the backend.

---

## Test Plan (Names → Behaviours)

- `prompt_registry_gets_and_sets_active_prompt_per_step`
  - Service correctly retrieves and updates active `coach_prompt_id` per step.

- `prompt_registry_resolve_prompt_prefers_explicit_else_active_else_errors`
  - `resolvePromptForStep` uses explicit id, falls back to active, and throws when neither is available.

- `web_adapter_exposes_active_prompt_endpoints`
  - `GET/POST /api/prompt-registry/active` return expected payloads and error codes.

- `prompt_registry_page_shows_active_badge_for_entry`
  - UI renders an “Active” indicator for the current prompt per step.

- `prompt_registry_page_set_active_calls_api_and_updates_state`
  - Clicking “Set active” triggers correct API calls and updates visible active entry.

- `draft_generation_uses_resolved_coach_prompt_id_when_configured`
  - `generateDrafts` writes resolved `coach_prompt_id` into draft metadata when `coachPromptStep` / `explicitCoachPromptId` are provided.

- `icp_coach_can_optionally_tag_profile_with_prompt_id`
  - Coach orchestration respects optional resolved `coach_prompt_id` when configured (for tagging/logging, without schema changes).

---

## Scope Guardrails

- No new database tables; `prompt_registry` remains the single source of truth, with `rollout_status` used to represent “active” per step (values and the `step` column have been aligned via a focused migration).

---

## Status Summary

### Completed in This Session

- `prompt_registry` schema aligned for Phase B:
  - Migration `20251204190000_update_prompt_registry_step_and_status.sql` added `step` and expanded `rollout_status` check to include `pilot`, `active`, `retired`, and `deprecated`.
- Core prompt registry helpers implemented in `src/services/promptRegistry.ts`:
  - `registerPromptVersion` updated to use the expanded status enum.
  - `getActivePromptForStep`, `setActivePromptForStep`, and `resolvePromptForStep` added and tested.
- Service-level tests added in `tests/promptRegistry.test.ts`:
  - `prompt_registry_gets_and_sets_active_prompt_per_step`.
  - `prompt_registry_resolve_prompt_prefers_explicit_else_active_else_errors`.

### To Do / Next Steps

- Web adapter/API:
  - Implement `GET /api/prompt-registry?step=<step>` to list entries and indicate which is active.
  - Implement `GET /api/prompt-registry/active?step=<step>` and `POST /api/prompt-registry/active` using the new service helpers.
  - Extend `src/web/server.test.ts` to cover these endpoints and error paths.
- Web API client / UI:
  - Add `fetchActivePrompt(step)` and `setActivePrompt(step, coachPromptId)` in `web/src/apiClient.ts`.
  - Update `PromptRegistryPage` to display an “Active” badge per step and a “Set active” control that calls these helpers.
  - Extend `web/src/pages/PromptRegistryPage.test.ts` to assert active badge rendering and “Set active” behaviour.
- Draft/coach integration:
  - Update `generateDrafts` to resolve `coach_prompt_id` once per run via `resolvePromptForStep` when `coachPromptStep`/`explicitCoachPromptId` are provided and ensure metadata writes remain centralized in `drafts.ts`.
  - Optionally extend coach flows to pass prompt selection parameters down into `generateDrafts` (without duplicating metadata logic). 
- No changes to legacy MCP or SIM flows; we only touch prompt selection and registry-related endpoints and services.
- No new prompt editing or free-form schema changes; we focus on selecting and resolving prompts, not authoring new scaffolds in this phase. 
