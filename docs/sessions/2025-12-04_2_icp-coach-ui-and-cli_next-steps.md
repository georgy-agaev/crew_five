# 2025-12-04 – ICP Coach UI + CLI + Prompt Management Next Steps (Phase A Delta)

> Timestamp (UTC): 2025-12-04T00:00:00Z  
> Goal: capture remaining ICP coach tasks (tests, small UX polish) and outline Phase A prompt management steps as a delta on top of the work completed in `2025-12-04_1_icp-coach-ui-and-cli-plan.md` and the Phase B plan in `2025-12-04_2_B_prompt-management-phase-b-plan.md`.

## Pre-reqs (done in previous session)

- Express ICP coach flow wired end-to-end:
  - Coach prompt loading (`icpCoach.ts`), coach orchestrator + jobs (`coach.ts`), coach Web endpoints (`/api/coach/icp`, `/api/coach/hypothesis`).
- Web UI ICP tab integrated with coach:
  - `IcpDiscoveryPage` shows “Coach result” lines and auto-selects created profiles/hypotheses.
- CLI commands implemented:
  - `icp:coach:profile` and `icp:coach:hypothesis` using shared `ChatClient` + `AiClient`, with JSON-only `{ jobId, profileId }` / `{ jobId, hypothesisId }` output.

## Carry-over TODOs from Previous Session

- Add focused React tests for `IcpDiscoveryPage`:
  - Assert that “Coach result” lines (including job ids) appear after successful coach runs.
  - Assert that coach errors surface via the existing `<Alert>` component.
- Add CLI tests for required arguments on new commands:
  - `icp:coach:profile` should fail clearly without `--name`.
  - `icp:coach:hypothesis` should fail clearly without `--icp-profile-id`.
- (Optional) Introduce a small shared type module for coach response envelopes (server + Web) to reduce duplication and make future schema changes safer.

## Prompt Management – Phase A (Read-only Scaffold + Registry View)

Phase B (active selection + resolution wiring into drafts/coach) is tracked in `docs/sessions/2025-12-04_2_B_prompt-management-phase-b-plan.md`. This document only tracks Phase A work: surfacing system scaffolds and improving the prompt registry view.

### Scope (files to touch)

- `src/web/server.ts`
  - Add a read-only endpoint `GET /api/prompt-scaffold?step=…` that returns system prompt scaffolds for known steps.
- `web/src/apiClient.ts`
  - Add `fetchSystemPrompt(step)` to call `/api/prompt-scaffold?step=…`.
- `web/src/pages/PromptRegistryPage.tsx`
  - Display system scaffold text for the selected step and add a “Copy scaffold into variant” helper (no active selection yet).
- `web/src/pages/PromptRegistryPage.test.ts`
  - Cover `fetchSystemPrompt` wiring and basic scaffold display/copy behaviour (helper-level or light integration tests).

### Functions (1–3 sentences)

- `fetchSystemPrompt(step)` (new, `web/src/apiClient.ts`)
  - Performs `GET /api/prompt-scaffold?step=<step>` and returns `{ step, prompt }` so the UI can show system scaffolds per step.

- `getPromptScaffold(step)` (new, `src/web/server.ts` / adapter deps)
  - Backend helper invoked by the web adapter; maps a `step` to the corresponding system prompt scaffold (loaded from `prompts/` or inline constants) and returns it as text.

- `PromptRegistryPage` (update)
  - When a step is selected, fetches and renders the system scaffold read-only, and provides a button to copy that scaffold into the “variant prompt text” textarea for faster variant creation.

### Tests (name → behaviour)

- `prompt_registry_fetches_system_scaffold_for_step`
  - `fetchSystemPrompt('draft')` hits `/api/prompt-scaffold?step=draft` and returns expected payload.

- `web_adapter_serves_prompt_scaffold_endpoint`
  - `GET /api/prompt-scaffold?step=draft` returns `{ step, prompt }` and appropriate error when `step` is missing/unknown.

- `prompt_registry_page_shows_scaffold_and_allows_copy_to_variant`
  - When scaffold is loaded, UI displays its text and “Copy scaffold” populates the variant textarea.

## Out of scope for This Doc

- Active prompt selection and `resolvePromptForStep`:
  - All active-selection semantics, prompt resolution, and wiring into drafts/coach services are handled in `docs/sessions/2025-12-04_2_B_prompt-management-phase-b-plan.md`.
- Additional schema changes or new tables for prompt management:
  - Phase A uses existing `prompt_registry` table and does not introduce new schema. 
