# 2025-12-10 Session – Prompts Tab Functional Wiring

> Timestamp: 2025-12-10T16:45:00

## Overview

We will finish the Prompts tab so that you can: (1) create prompts, (2) change their rollout status, and (3) reliably match each prompt to concrete workflow tasks (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message) by wiring the Task Configuration selectors to the existing prompt registry + active-prompt APIs. We will focus only on the behaviour needed for your workflow and reuse the current schema and endpoints, avoiding new legacy fallbacks.

## Scope (this session)

- Keep using the existing `prompt_registry` table and `/api/prompt-registry` + `/api/prompt-registry/active` endpoints; no new DB columns or tables.
- Ensure prompts created from the inline form (and the existing Prompt Registry page) show up consistently in Task Configuration and the registry table.
- Allow a user to mark a prompt as Active/Pilot/Retired per step and see that reflected in the table and summary chips.
- Wire the Task Configuration "Prompt" dropdowns so that choosing a prompt for each task updates the active prompt for the corresponding step and is persisted via the existing backend.
- Make minimal, focused UI and adapter changes in the `web/` and `src/web/` layers; do not touch CLI or unrelated flows.

## Files to Change

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Replace hard-coded Task Configuration prompt `<select>` options with real prompt entries per step.
  - Add change handlers that call the API to set the active prompt and update local state.
  - Ensure the "Active prompt" labels underneath each task reflect the latest active prompt per step.
- `web/src/apiClient.ts`
  - Reuse `fetchPromptRegistry`, `fetchActivePrompt`, and `setActivePrompt`; add any small helper wrappers if needed for cleaner Task Configuration wiring.
- `src/web/server.ts`
  - Likely no new routes; only adjust behaviour if we discover gaps in `createPromptRegistryEntry` or active-prompt handling that block the new UI.
- `tests/promptRegistry.test.ts`
  - Extend service-level tests only if we touch `src/services/promptRegistry.ts` further for status or step handling.
- `src/web/server.test.ts`
  - Add/adjust tests around live deps if we rely on new adapter behaviour for active prompt selection.
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Add helper tests that cover Task Configuration mapping and selection behaviour without mounting the full React tree.

## Functions Implemented or Adjusted

- `getActivePromptIdForStep(entries, step)` (existing)
  - Still the single source of truth for "Active prompt: …" display; we use it both in Task Configuration and the Prompt Registry table to highlight the active prompt per step.

- `buildPromptCreateEntry(form)` (existing)
  - Produces clean payloads (`id`, `step`, `version`, `description`, `rollout_status`, `prompt_text`) that the backend expects, without extra UI-only fields; reused by the inline create form.

- `mapTaskToPromptStep(taskKey)` (new helper in `PipelineWorkspaceWithSidebar.tsx`)
  - Maps Task Configuration keys (`'icpDiscovery' | 'hypothesisGen' | 'emailDraft' | 'linkedinMsg'`) to `PromptStep` values (`'icp_profile' | 'icp_hypothesis' | 'draft'`). LinkedIn currently returns `null` so it stays a visual stub.

- `getPromptOptionsForStep(entries, step)` (new helper in `PipelineWorkspaceWithSidebar.tsx`)
  - Given all `promptEntries` and a `PromptStep`, derives `{ value, label }` options for the Task Configuration prompt `<select>`, filtering by step and formatting labels as `id (version)`.

- `applyActivePromptSelection(step, coachPromptId, deps)` (new helper in `PipelineWorkspaceWithSidebar.tsx`)
  - Encapsulates the async flow used by both Task Configuration and the registry table: calls `setActivePrompt(step, coachPromptId)`, then `fetchPromptRegistry()`, and returns the refreshed rows so callers can update local state.

## Tests Added or Updated

_Target file: `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`_

- `it('maps task keys to prompt steps')`
  - Ensures task keys map to the expected `PromptStep` or `null`.
- `it('builds prompt options for step from entries')`
  - Confirms `getPromptOptionsForStep` filters by step and uses ids as option values.
- `it('applies active prompt selection via helper')`
  - Verifies `applyActivePromptSelection` calls `setActivePrompt` and refreshes registry rows.

## Task List

**Completed**
- Reviewed existing prompt registry schema, services, web adapter, and Prompts tab UI.
- Verified that prompt creation and listing now work end-to-end in live mode.
- Wired Task Configuration prompt `<select>` elements to real `promptEntries` and `PromptStep` mapping, including active-id based select values.
- Implemented a shared `applyActivePromptSelection` helper and used it for both Task Configuration and the registry table "Set active" button so that active status changes are persisted and reflected consistently.
- Added helper-level tests in `PipelineWorkspaceWithSidebar.test.ts` to cover task mapping, option building, and active selection wiring; all tests pass for this file.

**To Do (future sessions)**
- Consider adding full React Testing Library coverage for the Prompts tab UI (mounting `PipelineWorkspaceWithSidebar` and simulating user interactions) once jsdom-based tests are stable across the suite.
- Expand status-management UI beyond "Set active" (for example, explicit Retire actions) if your workflow needs more granular lifecycle controls.
- Add adapter/service tests only if we further evolve server-side prompt registry logic beyond the current active-prompt endpoints.
