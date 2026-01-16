# 2025-12-04 – Web UI Consolidation Plan

> Timestamp (UTC): 2025-12-04T00:00:00Z
> Goal: organize the Web UI around clear flows (ICP, Segments/Enrichment, Prompts, Drafts, Analytics), tidy API usage, and ship only the minimal working features with prompt management (active selection + scaffold view). No legacy fallbacks.

## Overview
We’ll refactor the Web UI surface to use domain-grouped API calls, add prompt management (system scaffold, copy-as-variant, active per step), and ensure the ICP → Segment/Snapshot → Enrich → Draft → Analytics flows are coherent. Anything not ready (e.g., send) will be clearly marked experimental/disabled rather than half-wired.

## Status (this session)
- **Completed (pre-reqs + today)**  
  - ICP coach express flow (web + CLI) wired end-to-end.  
  - Prompt registry service helpers for `getActivePromptForStep`, `setActivePromptForStep`, and `resolvePromptForStep` with tests.  
  - Web adapter endpoints for prompt registry “active per step” (`GET /api/prompt-registry?step=…`, `GET /api/prompt-registry/active`, `POST /api/prompt-registry/active`) plus coverage in `src/web/server.test.ts`.  
  - Web API client helpers and Prompt Registry UI updates for active selection (`fetchPromptRegistry(step)`, `fetchActivePrompt`, `setActivePrompt`, `PromptRegistryPage` active badge + “Set active” button).  
- **To Do (current session)**  
  - (None for this slice; remaining Web UI consolidation items such as `useAsyncState`, EventsPage trimming, and WorkflowZero prompt selector refactors stay as **future-session TODOs** once prompt management is stable.)

## Scope (files to touch)
- Core wiring: `web/src/apiClient.ts`, `web/src/types.ts` (shared types), `web/src/hooks/useAsyncState.ts` (new) for loading/error.
- Prompts: `web/src/pages/PromptRegistryPage.tsx`, `web/src/pages/WorkflowZeroPage.tsx` (prompt selector), `web/src/apiClient.ts`, `src/web/server.ts` (scaffold + active prompt endpoints), `src/services/promptRegistry.ts` (active resolver), `src/services/drafts.ts` / `src/services/coach.ts` (use resolved prompt).
- ICP: `web/src/pages/IcpDiscoveryPage.tsx`, `web/src/apiClient.ts`, tests.
- Segments/Enrichment: `web/src/pages/WorkflowZeroPage.tsx`, `web/src/apiClient.ts`, tests (snapshot guard, enrichment status).
- Analytics (minimal): `web/src/pages/EventsPage.tsx` (keep working sections only), `web/src/apiClient.ts`.
- CLI/docs: `CHANGELOG.md`, `docs/web_ui_requirements.md` (flow how-to), optional small updates to `docs/AI_SDR_Toolkit_Architecture.md`.

## Functions (1–3 sentences)
- `useAsyncState` (new, `web/src/hooks/useAsyncState.ts`): small hook to manage `{data, loading, error}` for fetches to reduce duplicated state handling.
- `fetchSystemPrompt(step)` (new, `web/src/apiClient.ts`): GET system scaffold for a step to display read-only.
- `setActivePrompt(step, promptId)` (new, `web/src/apiClient.ts`): POST/PATCH active prompt per step in registry.
- `resolvePromptForStep(step, explicitId?)` (new/updated, `src/services/promptRegistry.ts` or helper): returns explicit ID if provided, else active for step, else throws.
- `generateDrafts`/`generateDraftsForSegmentWithIcp` (update, `src/services/drafts.ts` / `src/services/coach.ts`): thread resolved `coach_prompt_id` and keep metadata consistent.
- `PromptRegistryPage` (update): show system scaffold, copy-as-variant prefill, set active per step, list entries.
- `WorkflowZeroPage` (update): prompt selector uses active/explicit prompt; enforces snapshot v1 and enrichment status; uses consolidated api client.
- `IcpDiscoveryPage` (update): coherent ICP/hypothesis creation + coach runs, shows ids/jobIds, auto-selects new entities, displays errors.
- `EventsPage` (update): keep only working analytics/registry display (groupings, suggestions) and drop/mark anything non-functional.

## Tests (name → behaviour)
- `prompt_registry_shows_scaffold_and_copy_variant`: displays system scaffold and prefills variant form.
- `prompt_registry_sets_active_prompt_per_step`: set active updates state/UI; persists via API.
- `prompt_resolver_prefers_explicit_else_active_else_errors`: resolve explicit ID, fallback to active, else throw.
- `draft_generation_uses_resolved_prompt_id`: draft metadata includes chosen `coach_prompt_id` (explicit or active).
- `icp_page_shows_ids_and_job_ids_after_coach_run`: coach success renders ids/jobId, auto-selects.
- `icp_page_displays_coach_error`: API error shown in Alert.
- `workflow_zero_enforces_snapshot_and_enrichment_status`: snapshot v1 required; enrichment status rendered.
- `workflow_zero_prompt_selector_uses_active_prompt`: active prompt preselected; can override explicitly.
- `events_page_renders_working_analytics_sections_only`: grouped analytics and registry render; unused blocks hidden.

## Out of scope
- Send flow expansion (keep labeled experimental/disabled if present).
- New schemas or legacy/MCP fallbacks.
