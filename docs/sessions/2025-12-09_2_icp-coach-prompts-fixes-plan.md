2025-12-09 22:16

Status: Planning

Tags: #crew_five #web_ui #icp_coach #prompts

# Session Plan – ICP Coach Chat + Prompts Tab Fixes

> Version: v0.1 (2025-12-09)

## Overview

- Stabilize the Pipeline Workspace ICP/Hypothesis “Chat with AI” flow so it uses the ICP coach endpoints without leaking enrichment/draft errors and so it can optionally carry a `promptId` selected from the Prompts tab.
- Make the Prompt Registry fully usable from the current web UI: users should be able to create prompt entries, see them in the Prompts tab, and mark one as active per step so ICP coach and draft generation can resolve them.
- Keep the existing Option B layout, colors, and interaction model intact; changes are strictly about wiring and behaviour, not redesigning the shell.

## Scope & Non‑Goals

- Implement only what is needed for:
  - ICP/Hypothesis chat using the ICP coach with a prompt identifier sourced from the Prompt Registry.
  - Creating and activating prompt entries for `icp_profile`, `icp_hypothesis`, and `draft` inside the current UI.
- No legacy/Workflow Zero fallbacks or alternate shells; `PipelineWorkspaceWithSidebar` remains the main UI.
- No new connector types or schema changes beyond what prompt registry already supports.

## Target Functionality (What We Will Implement)

1. **Prompt registry backend normalization**
   - Normalize `/api/prompt-registry` responses so `id` is the human `coach_prompt_id`, not the internal UUID.
   - Ensure `/api/prompt-registry` inserts never try to write a non‑UUID into the `id uuid` column.
   - Ensure `/api/prompt-registry/active` uses the human `coach_prompt_id` end‑to‑end so “Set active” works.

2. **ICP coach prompt threading**
   - Extend ICP coach service inputs and jobs to optionally carry `promptId` for both profile and hypothesis.
   - Make the live web adapter `generateIcpProfile` / `generateIcpHypothesis` forward `promptId` from HTTP to the ICP coach service.
   - Confirm web API client and workspace already send `promptId` from active prompt where available.

3. **Prompts tab usability**
   - Allow users to create prompt entries for the three main steps, using the existing “Create Prompt” concept rather than introducing a new page.
   - Make the Prompts tab clearly show which prompt is active per step and ensure the “Set active” interaction persists in Supabase.
   - Keep all visuals aligned with `docs/options/PipelineWorkspaceWithSidebar.tsx` (same background, spacing, typography).

4. **Error clarity for enrichment vs. ICP coach**
   - Keep enrichment‑specific “No segment members found for finalized segment” errors mapped to a friendly message in the Enrich step.
   - Ensure ICP/Hypothesis chat uses only coach endpoints and surfaces coach‑specific errors (e.g., missing prompt config) distinctly from enrichment issues.

## Files Likely to Change

- Backend:
  - `src/services/promptRegistry.ts`
  - `src/services/coach.ts`
  - `src/web/server.ts`
  - (Tests) `tests/promptRegistry.test.ts`, `src/web/server.test.ts`, `tests/coach.test.ts`
- Web client & UI:
  - `web/src/apiClient.ts`
  - `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - (Tests) `web/src/apiClient.test.ts`, `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
- Docs:
  - This session file.
  - Potentially `docs/prompt_reference_usage.md` or `docs/options/Pipeline Workspace - API Endpoints Inventory.md` if behaviour changes materially.

## Planned Functions / Helpers (New or Updated)

- `normalizePromptRegistryRow(row: any): PromptEntryLike` (server)
  - Small internal helper inside `src/web/server.ts` to map Supabase `prompt_registry` rows into a UI‑friendly shape where `id` is the human `coach_prompt_id`, and `is_active` is derived from `rollout_status`.

- `registerPromptVersion(client, input)` (server, already exists)
  - Will remain the CLI‑facing helper for inserting prompt versions; ensure it uses `coach_prompt_id` and `step` correctly without overriding the UUID primary key.

- `createIcpProfileViaCoach(client, chatClient, input)` (server, updated)
  - Accepts `IcpCoachProfileInput` extended with `promptId?: string`, records it in the job payload, and then creates a corresponding ICP profile row.

- `createIcpHypothesisViaCoach(client, chatClient, input)` (server, updated)
  - Same as above but for hypotheses; associates the generated hypothesis with the ICP profile and records `promptId` in the job payload.

- `generateIcpProfile(payload)` / `generateIcpHypothesis(payload)` (web adapter live deps)
  - Accept HTTP body fields (`name`, `description`, `icpProfileId`, etc.) including optional `promptId`, forward them to the appropriate ICP coach helpers, and return `{ jobId, ...profile/hypothesis }`.

- `getPromptStatusKey(entry)` / `getActivePromptIdForStep(entries, step)` (workspace UI, already present)
  - Continue to serve as the single source of truth for prompt status filtering and “Active prompt: …” labels; adjust to assume `entry.id` is the human prompt id.

## Tests to Add / Update (Names & Behaviours)

- `prompt_registry_normalizes_rows_for_ui_and_activation`
  - Verifies `/api/prompt-registry` returns entries with `id === coach_prompt_id` and that “Set active” uses the human id.

- `prompt_registry_rejects_non_uuid_primary_key_but_accepts_coach_prompt_id`
  - Ensures insertion does not attempt to override the UUID `id` column while still persisting `coach_prompt_id`, `step`, `version`, and `rollout_status`.

- `coach_icp_profile_job_payload_includes_prompt_id_when_present`
  - Confirms `createIcpProfileViaCoach` writes `promptId` into the job payload when provided.

- `coach_icp_hypothesis_job_payload_includes_prompt_id_when_present`
  - Same as above, but for `createIcpHypothesisViaCoach`.

- `web_adapter_live_forwards_prompt_id_to_icp_coach_helpers`
  - Asserts that `generateIcpProfile` / `generateIcpHypothesis` in `createLiveDeps` pass through `promptId` from HTTP bodies to the ICP coach service.

- `workspace_prompts_tab_set_active_uses_prompt_id_not_uuid`
  - Component/helper‑level test that the Prompts tab computes active prompts using the normalized `id` and calls `setActivePrompt(step, id)` appropriately.

- `workspace_prompts_tab_create_prompt_posts_expected_payload`
  - Confirms that enabling “Create Prompt” in the Prompts tab sends `{ coach_prompt_id, step, version, rollout_status, prompt_text }` to `/api/prompt-registry`.

## TDD & Execution Notes

- For each code block above, we will:
  1. Add or update the corresponding tests and run them in isolation via `pnpm test <file>` until they fail with a clear reason.
  2. Implement or adjust the production code to satisfy the tests.
  3. Re‑run the same focused tests to ensure a 100% pass rate for that block.
  4. Periodically run `pnpm build` to keep TypeScript clean, and only touch linting where it directly relates to modified files.
- After completing all blocks, we will update this session doc to mark tasks as “Completed” and add a short summary in `CHANGELOG.md` or prompt docs if the behaviour change is user‑visible.

## Status & Outcomes

- Prompt registry backend now normalizes `/api/prompt-registry` rows so `id` and `coach_prompt_id` both reflect the human prompt identifier, live deps no longer attempt to insert non‑UUID ids into the primary key column, and a new `prompt_text` column lets the inline Create Prompt form store the textarea content.
- ICP coach live adapter functions (`generateIcpProfile`, `generateIcpHypothesis`) thread optional `promptId` values from HTTP bodies into `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach`, which in turn include `promptId` inside job payloads for later analytics.
- The Pipeline workspace Prompts tab gained an inline “Create prompt” form using `buildPromptCreateEntry` and `createPromptRegistryEntry`, allowing creation of `icp_profile`, `icp_hypothesis`, and `draft` prompts and immediate refresh of the table; “Set active” now reliably updates Supabase via `/api/prompt-registry/active`.
- Targeted tests were added/updated in `src/web/server.test.ts`, `tests/coach.test.ts`, and `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`; all run green, and `pnpm build` succeeds after the changes.
- The left navigation collapse button now renders `P`, `I`, `A`, `PR` with centered labels so the collapsed tab letters stay balanced, and the compact Create Prompt form can save without hitting schema errors.
