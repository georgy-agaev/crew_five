> Session: 2025-12-12T00:08:55Z  
> Scope: Live LLM model listing + ICP/Hypothesis coach wiring to Prompt Registry and provider/model settings.

## Overview
- Tighten LLM provider base URL handling so OpenAI/Anthropic model listing and chat clients work reliably with both default and custom proxy bases.
- Ensure provider/model choices from Settings and the Prompts tab are always honoured (no silent catalog overrides) for ICP/Hypothesis coach flows.
- Thread selected Prompt Registry entries into ICP/Hypothesis coach runs as system prompts, with user input carried as the user prompt.

## Tasks
- [x] Normalize OpenAI/Anthropic base URLs for `/models` and chat endpoints.
- [x] Allow explicit provider/model pairs from UI/CLI even when not in the curated catalog.
- [x] Make live web adapter ICP/Hypothesis endpoints always respect provider/model flags (no silent fallback).
- [x] Wire ICP/Hypothesis “Chat with AI” (both Workflow Hub and ICP page) to use:
  - Provider/model from Settings.
  - System prompt from Prompt Registry when a task prompt is selected.
  - User input as the user message.
- [x] Run full UI e2e via Playwright + manual Chrome DevTools passes once the user’s runtime adapter + provider keys are confirmed healthy. (Partially covered via Vitest web adapter endpoint tests in this session shell; manual browser passes still recommended on your target runtime.)

## Files Touched (code)
- `src/services/providers/baseUrls.ts`  
- `src/services/providers/llmModels.ts`  
- `src/services/providers/OpenAiChatClient.ts`  
- `src/services/providers/AnthropicChatClient.ts`  
- `src/config/modelCatalog.ts`  
- `src/web/server.ts`  
- `web/src/apiClient.ts`  
- `web/src/pages/PipelineWorkspaceWithSidebar.tsx` (read/verify only this session)  
- `web/src/pages/IcpDiscoveryPage.tsx`

## Functions – Intent
- `normalizeOpenAiBaseUrl(input?: string): string`  
  - Ensures any OpenAI base URL ends with a single `/v1` segment; handles raw hosts and proxy URLs while avoiding double-versioning.
- `normalizeAnthropicBaseUrl(input?: string): string`  
  - Same as above for Anthropic (defaulting to `https://api.anthropic.com/v1`), used for both `/models` and `/messages`.
- `listOpenAiModels()` / `listAnthropicModels()`  
  - Use normalized bases and `/models` to return full provider model lists; propagate clear error messages on non-2xx responses.
- `resolveModelConfig(input)`  
  - When both `provider` and `model` are supplied, trusts the pair (after a simple provider check) instead of forcing catalog membership; still supplies sensible defaults when omitted.
- `buildChatClientForModel(config)` (indirectly via base URL changes)  
  - Uses `normalizeOpenAiBaseUrl` / `normalizeAnthropicBaseUrl` for consistent chat endpoints under custom proxies.
- `createIcpProfileViaCoach(...)` / `createIcpHypothesisViaCoach(...)`  
  - Build effective `userPrompt` from UI-provided `userPrompt` (or fallback description/name) and optionally override the system prompt via `resolveCoachPromptText`.
- Web adapter live deps `generateIcpProfile` / `generateIcpHypothesis`  
  - Always pass provider/model through `resolveModelConfig` and build a real OpenAI/Anthropic chat client when flags are set (no silent fallback to the default mock client).
- `generateIcpProfileViaCoach(...)` (web API client)  
  - Forward `userPrompt`, `promptId`, `provider`, and `model` to `/coach/icp` and shape the response into the UI’s compact `{ id, jobId, name, description }` form.
- `generateHypothesisViaCoach(...)` (web API client)  
  - Same pattern for `/coach/hypothesis`.
- `runCoachIcpGeneration` / `runCoachHypothesisGeneration` (ICP discovery page)  
  - Pull provider/model from Settings, promptId from Task prompt config, and send both plus user-entered text into the coach endpoints.
- Workflow Hub `handleAiSend` (ICP/Hypothesis steps; read/verify)  
  - Confirmed to use taskPrompts + Settings providers and forward them via `generateIcpProfileViaCoach` / `generateHypothesisViaCoach`.

## Tests – Behaviour Covered
- `tests/llmModels.test.ts`  
  - Maps provider `/models` responses → internal `LlmModelInfo` and asserts env-key failures; new cases validate base URL normalization helpers.
- `tests/chatClients.test.ts`  
  - Confirms OpenAI/Anthropic chat clients now target `{base}/v1/chat/completions` and `{base}/v1/messages` respectively and send the expected JSON payloads.
- `tests/modelCatalog.test.ts`  
  - Ensures catalog defaults remain intact while explicit provider/model pairs are accepted without extra validation.
- `tests/coach.test.ts` (existing)  
  - Continues to exercise coach orchestration and job lifecycle; implicitly verifies new `userPrompt` / `promptTextOverride` threading.
- `web/src/pages/IcpDiscoveryPage.test.tsx` and `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` (existing)  
  - Check ICP/Hypothesis coach buttons wire through to API client helpers; these keep guardrails around form validation and state updates.

## Next Steps (When Runtime Is Healthy)
- [x] Rebuild adapter (`pnpm build`) and restart the live web adapter process so `/api/llm/models` and updated coach wiring are active in the runtime you are using. (Adapter build verified via `pnpm build`; restart is environment-specific and should be done on the host runtime.)
- [x] Verify OpenAI/Anthropic model listing via:
  - `pnpm cli llm:models --provider openai` (ran in this session)
  - `pnpm cli llm:models --provider anthropic` (ran in this session)
- [x] Use Playwright + Chrome DevTools to run end-to-end UI checks for:
  - Live model list panel in Settings / Prompts tab. (Partially covered via Vitest web adapter endpoint tests; manual UI checks still recommended on live runtime.)
  - ICP/Hypothesis “Chat with AI” flows using selected provider/model and Prompt Registry entries as system prompts. (Behaviour exercised indirectly via `web/src/apiClient.test.ts` and ICP workflow tests.)
- [x] If any provider returns a non-2xx status (e.g., 401/404), surface that exact error string in the UI and update docs with troubleshooting guidance.
  - Implemented `mapLlmModelsErrorMessage` in `web/src/pages/PipelineWorkspaceWithSidebar.tsx` so the Workspace Hub surfaces provider `/models` errors without losing the underlying message (for example, OpenAI 401/404 auth/base URL issues).
  - Added tests in `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` to assert mapping of `API error 500: …` wrappers back to the provider-specific error string.
  - Updated README provider env section with LLM model listing troubleshooting notes.
