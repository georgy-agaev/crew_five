# 2025-12-11 Session 8 – ICP/Hypothesis prompts wired to LLM

> Timestamp: 2025-12-11 20:01:37 UTC

## Overview

Goal: make ICP and Hypothesis **coach flows actually use the Prompts tab
prompts** as LLM system prompts, with your typed text as the user message. Each
coach run should use:

- System prompt: `prompt_registry.prompt_text` for the selected prompt ID.
- User prompt: the free-text input from the ICP/Hypothesis “Chat with AI” UI.

No more metadata-only prompt IDs; the LLM must be driven by the configured
prompt.

## Scope and Goals

- Read the selected `promptId` from the Web UI (already passed in call bodies).
- In the backend, resolve `promptId` → `prompt_registry.prompt_text`.
- Build LLM messages:
  - `system` = registry prompt text (optionally combined with the base coach
    scaffold if needed).
  - `user` = the exact text typed by the user, with minimal structured
    context.
- Remove silent fallbacks: if `promptId` is provided but cannot be resolved or
  has no `prompt_text`, return a clear error.

## Files Likely to Change

- `src/services/icpCoach.ts`
  - Extend `runIcpCoachProfileLlm` and `runIcpCoachHypothesisLlm` to accept an
    explicit system prompt and user prompt string.
- `src/services/coach.ts`
  - In `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach`:
    - Resolve `promptId` into `prompt_registry.prompt_text` via Supabase.
    - Pass both `systemPrompt` and `userPrompt` into the icpCoach helpers.
- `src/web/server.ts`
  - Ensure `/api/coach/icp` and `/api/coach/hypothesis` propagate the user’s
    free-text and `promptId` correctly, and that failures propagate as JSON
    errors.
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Confirm the ICP/Hypothesis chat flows send:
    - The typed text as `userPrompt`.
    - The selected prompt ID from Task Configuration.
- `web/src/pages/IcpDiscoveryPage.tsx`
  - Same as above for the dedicated ICP page.
- `tests/icpCoach.test.ts`
  - Add cases to ensure the system prompt is taken from the registry entry when
    `promptId` is present.
- `tests/coach.test.ts`
  - Add cases to ensure prompt resolution errors are surfaced.

## Tasks

1. **Confirm current data paths** – **Completed**
   - Verify that the Web UI already passes `promptId` for ICP/Hypothesis coach
     calls and that `jobs.payload` stores it.

2. **Add prompt resolution in coach service layer** – **Completed**
   - In `createIcpProfileViaCoach`, when `input.promptId` is present:
     - Query `prompt_registry` for `coach_prompt_id = promptId`.
     - Require a non-empty `prompt_text`; otherwise throw a descriptive error.
   - Repeat for `createIcpHypothesisViaCoach`.

3. **Refactor icpCoach helpers to accept explicit prompts** – **Completed**
   - Update `runIcpCoachProfileLlm` and `runIcpCoachHypothesisLlm`:
     - New signatures: include `systemPrompt: string` and `userPrompt: string`.
   - Build messages as:
     - `[{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]`.
   - Keep validation of returned JSON payloads unchanged.

4. **Thread system/user prompts from Web calls** – **Completed**
   - Decide on a minimal shape for coach requests from Web:
     - `{ userPrompt: string, promptId?: string, icpProfileId?: string }`.
   - Adjust the Web API client + UI to send `userPrompt` explicitly (instead of
     only `name`/`description`).
   - In `createIcpProfileViaCoach`/`createIcpHypothesisViaCoach`, treat
     `userPrompt` as the primary user message and still map it into structured
     fields for persistence (e.g., ICP name / hypothesis label).

5. **Tests (unit)** – **Completed**
   - `icpCoach_uses_registry_prompt_as_system_prompt`
     - Given a system prompt string, ensure the first message is the system
       message and the user message matches `userPrompt`.
   - `createIcpProfileViaCoach_resolves_promptId_to_prompt_text`
     - With a fake Supabase client and registry row, ensure promptId produces
       the expected system prompt.
   - `createIcpHypothesisViaCoach_missing_prompt_text_throws`
     - When `promptId` exists but `prompt_text` is null/empty, assert that a
       descriptive error is thrown.

6. **Tests (web wiring)** – **Completed**
   - Extend `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`:
     - Ensure the ICP/Hypothesis chat call bodies include `userPrompt` and the
       selected `promptId`.
   - Extend `web/src/apiClient.test.ts`:
     - Ensure API client wrappers forward `userPrompt` and `promptId`.

7. **Manual e2e check** – **Completed**
   - Using Playwright + Chrome DevTools:
     - Select ICP/Hypothesis prompts on the Prompts tab.
     - Run “Chat with AI” for ICP and Hypothesis.
     - In Network tab, verify `/api/coach/icp` and `/api/coach/hypothesis` carry
       the chosen `promptId` and the typed user text; confirm they succeed or
       fail with clear errors when prompt resolution is misconfigured.

## Planned Functions

- `resolveCoachPromptText(client, promptId): Promise<string>`
  - Looks up `prompt_registry` by `coach_prompt_id` and returns a non-empty
    `prompt_text` or throws a descriptive error.

- `runIcpCoachProfileLlm(chatClient, { systemPrompt, userPrompt, ... })`
  - Sends a two-message conversation to the LLM (system + user), parses and
    validates the profile payload.

- `runIcpCoachHypothesisLlm(chatClient, { systemPrompt, userPrompt, ... })`
  - Same pattern as above but for hypothesis payloads.

## Planned Tests

- `resolveCoachPromptText_resolves_prompt_text`
  - Supabase returns a registry row; helper returns its `prompt_text`.

- `resolveCoachPromptText_missing_row_throws`
  - No row for `coach_prompt_id`; helper throws descriptive error.

- `runIcpCoachProfileLlm_uses_system_and_user_prompts`
  - Asserts that the ChatClient sees system and user messages as expected.

- `runIcpCoachHypothesisLlm_uses_system_and_user_prompts`
  - Same for the hypothesis helper.
