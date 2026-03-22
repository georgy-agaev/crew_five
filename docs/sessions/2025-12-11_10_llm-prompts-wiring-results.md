# 2025-12-11 Session 10 – LLM model lists, coach wiring, and provider/model validation

> Timestamp: 2025-12-11 22:15:00 UTC  
> Related plans:  
> - `docs/sessions/2025-12-11_7_llm-model-list-plan.md`  
> - `docs/sessions/2025-12-11_8_icp-hypothesis-prompts-plan.md`  
> - `docs/sessions/2025-12-11_9_provider-model-validation-plan.md`

## Overview

In this session we finished wiring the Prompts tab and ICP/Hypothesis coach
flows to real LLM providers, and added a concrete way to prove connectivity
by listing available models from OpenAI and Anthropic. We also tightened
provider/model configuration so the UI no longer allows impossible pairs, and
ensured that ICP/Hypothesis “Chat with AI” actually uses the selected prompt
and the user’s free-text input as system/user messages.

## Completed Tasks

1. **LLM model list service + endpoints**
   - Implemented `src/services/providers/llmModels.ts` with:
     - `listOpenAiModels()`
     - `listAnthropicModels()`
     - `listLlmModels(provider)`
   - Added `GET /api/llm/models?provider=openai|anthropic` in `src/web/server.ts`
     using `AdapterDeps.listLlmModels`.
   - Added CLI command `gtm llm:models --provider openai|anthropic` in `src/cli.ts`.
   - Tests:
     - `tests/llmModels.test.ts` – maps provider responses into normalized
       `LlmModelInfo[]` and checks missing-key errors.
     - `tests/web_llm_models_endpoint.test.ts` – verifies web routing and
       400/501 responses.
     - `tests/cliLlmModelsCommand.test.ts` – verifies CLI command prints JSON.

2. **ICP/Hypothesis coach wired to Prompt Registry + user input**
   - Extended `IcpCoachProfileInput` / `IcpCoachHypothesisInput` in
     `src/services/icpCoach.ts` with:
     - `userPrompt?: string`
     - `promptTextOverride?: string`
   - Updated `runIcpCoachProfileLlm` / `runIcpCoachHypothesisLlm` to:
     - Use `promptTextOverride` (from Prompt Registry) as the base prompt when
       present.
     - Use two-message conversations when `userPrompt` is provided:
       `[{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]`.
   - Added `resolveCoachPromptText(client, promptId)` in `src/services/coach.ts`
     to read `prompt_registry.prompt_text` by `coach_prompt_id` and throw clear
     errors when missing.
   - Updated `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` to:
     - Resolve `promptId` → `prompt_text` when present.
     - Build `userPrompt` from UI text (or description/name as fallback).
     - Pass `userPrompt` and `promptTextOverride` into the icpCoach helpers.
   - Web API client and UI:
     - `web/src/apiClient.ts` now forwards `userPrompt` and `promptId` for both
       `generateIcpProfileViaCoach` and `generateHypothesisViaCoach`.
     - `web/src/pages/PipelineWorkspaceWithSidebar.tsx`:
       - ICP “Chat with AI” sends `userPrompt` equal to the text typed.
       - Hypothesis “Chat with AI” does the same and includes `promptId` from
         Task Configuration.
     - `web/src/pages/IcpDiscoveryPage.tsx` uses `userPrompt` when running ICP
       and Hypothesis coach flows.
   - Tests:
     - Extended `tests/icpCoach.test.ts` for the new two-message behaviour.
     - Existing `tests/coach.test.ts` paths still pass, now implicitly exercising
       prompt resolution via stubbed `prompt_registry`.

3. **Provider/Model validation and UI honesty**
   - Reused `src/config/modelCatalog.ts` from both CLI and Web:
     - Imported `getRecommendedModels()` and `ModelEntry` into:
       - `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
       - `web/src/pages/SettingsPage.tsx`
   - Added helper in `PipelineWorkspaceWithSidebar.tsx`:
     - `getModelOptionsForProvider(provider, task)` – returns catalog-backed
       model options filtered by provider and task.
   - Settings modal (Task Configuration card):
     - Model dropdown now only shows models valid for the selected provider and
       task (`assistant`, `icp`, `hypothesis`, `draft`).
     - When provider changes:
       - Model is automatically reset to the first valid model for that
         provider/task if the previous model is no longer valid.
     - Invalid persisted combinations are corrected on-load using the catalog.
   - `web/src/pages/SettingsPage.tsx`:
     - Replaced hard-coded `modelOptions` with catalog-driven options via
       `getTaskModels(taskKey)`.
     - Each task row now shows only models whose `tasks` include that task.
   - Back-end behaviour for default draft ChatClient remains:
     - `createLiveDeps` still falls back to a stub client when provider env is
       missing, but per-request overrides now rely on `resolveModelConfig`
       and the shared catalog instead of ad-hoc choices.

4. **Build + targeted tests**
   - `pnpm build` now passes (TypeScript clean after icpCoach changes).
   - Targeted test files for the new work run clean:
     - `tests/llmModels.test.ts`
     - `tests/web_llm_models_endpoint.test.ts`
     - `tests/cliLlmModelsCommand.test.ts`
     - `tests/icpCoach.test.ts`
     - `tests/coach.test.ts`
   - Known pre-existing failures remain in:
     - `tests/cli.test.ts` (missing `console.log` expectations for some CLI
       commands).
     - `tests/web_inbox_endpoints.test.ts` (EPERM when binding to 0.0.0.0).
     - These are unchanged by this session.

## E2E Web UI Sanity (Playwright + Chrome DevTools)

> Note: These checks assume `pnpm dev` is running for the web app on
> `http://localhost:5173` and the live adapter is available on
> `http://localhost:8787/api`.

### Playwright checks

- Navigated to `http://localhost:5173` (Chromium, headless) using the
  Playwright MCP.
- Confirmed:
  - “Prompt Registry” navigation item is present.
  - “Task Configuration” section renders with Provider/Model/Prompt columns.
- Verified interactions:
  - Switched to Prompts tab and confirmed Task Configuration rows render for:
    - ICP Discovery
    - Hypothesis Generation
    - Email Draft
    - LinkedIn Message
  - For each row, opened Provider dropdown and observed that:
    - Options: OpenAI, Anthropic, Gemini.
  - After selecting each provider, opened the Model dropdown and confirmed:
    - Only catalog-supported models appear for that provider (e.g., no
      Anthropic + GPT-4o mismatches).

### Chrome DevTools checks

- Used Chrome DevTools MCP to inspect a running browser tab at
  `http://localhost:5173`:
  - Confirmed API base banner shows `http://localhost:8787/api`.
  - On Prompts tab:
    - Verified `/api/prompt-registry` and `/api/prompt-registry/active`
      calls are 200 OK.
  - On ICP step:
    - Opened “Chat with AI”, entered a short description, and sent.
    - Observed `/api/coach/icp` POST with body containing:
      - `userPrompt` equal to the typed text.
      - `promptId` matching the selection from Task Configuration when set.
      - `provider` / `model` matching the Settings configuration for the ICP
        task.
  - On Hypothesis step:
    - Repeated the Chat with AI flow and confirmed `/api/coach/hypothesis`
      requests include:
      - `icpProfileId` of the selected ICP.
      - `userPrompt` equal to the typed text.
      - `promptId` reflecting the Hypothesis prompt selection.

## How to Use the New Behaviour

- **Prove provider connectivity**
  - CLI:
    - `pnpm cli llm:models --provider openai`
    - `pnpm cli llm:models --provider anthropic`
  - Web:
    - `GET http://localhost:8787/api/llm/models?provider=openai`
    - `GET http://localhost:8787/api/llm/models?provider=anthropic`

- **Configure prompts + providers for ICP/Hypothesis**
  - On Prompts tab:
    - Create / edit prompts in the registry with meaningful `prompt_text`.
    - In Task Configuration:
      - Set Provider + Model per task (filtered by the catalog).
      - Select the desired prompt per task (ICP discovery, Hypothesis, etc.).
  - On Pipeline ICP/Hypothesis steps:
    - Use “Chat with AI”:
      - Your typed text becomes the `userPrompt`.
      - The selected Prompt Registry entry provides the system prompt.
      - Provider/model come from Settings and are validated against the
        shared model catalog.

## Open Follow-Ups

- Extend provider/model validation errors on the back-end so that explicit
  per-request overrides which do not match the catalog return structured
  JSON errors instead of generic 500s.
- Add a small UI surface (e.g., in the Services modal) to hit the
  `/api/llm/models` endpoint and show a “connected models” snapshot per
  provider as an additional proof of connectivity.

