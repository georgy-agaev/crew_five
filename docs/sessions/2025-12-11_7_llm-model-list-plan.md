# 2025-12-11 Session 7 – LLM model-list endpoints

> Timestamp: 2025-12-11 20:01:37 UTC

## Overview

You want a **concrete proof** that our OpenAI and Anthropic connections are real:
from the running system, with your API keys, you should be able to request and
see **the list of models** reported by each provider. This session will focus
only on that: a minimal, end-to-end way to fetch `models` from the providers and
surface them as JSON (CLI + Web API) with proper error handling, **no legacy
fallbacks**.

## Scope and Constraints

- Only implement what is necessary to:
  - Call the provider's official "list models" endpoint using existing API keys.
  - Return a normalized list of model identifiers and basic metadata.
  - Expose that via:
    - A CLI command (e.g. `gtm llm:models --provider openai|anthropic`).
    - A Web API endpoint (e.g. `GET /api/llm/models?provider=openai`).
- Do **not** invent stub lists or automatic fallbacks when configuration is
  missing; instead, return clear errors.
- Keep integration narrow: no changes to draft/coach flows in this session.

## Files Likely to Change

- `src/services/providers/OpenAiChatClient.ts`
  - Optionally reuse base URL and API key loading or factor a small helper.
- `src/services/providers/AnthropicChatClient.ts`
  - Same as above for Anthropic.
- `src/services/providers/llmModels.ts` (new)
  - Provider-specific functions that call `GET /v1/models` (OpenAI) and the
    equivalent Anthropic endpoint and normalize the responses.
- `src/web/server.ts`
  - Extend `AdapterDeps` with `listLlmModels`.
  - Add dispatch route: `GET /api/llm/models` reading `provider` query param and
    returning the model list or a provider-specific error.
- `src/cli.ts`
  - Add a command `llm:models` that calls the same functions and prints JSON.
- `tests/llmModels.test.ts` (new)
  - Service-level tests for `listOpenAiModels` / `listAnthropicModels`.
- `tests/web_llm_models_endpoint.test.ts` (new)
  - Tests covering the web endpoint wiring.
- `tests/cliLlmModelsCommand.test.ts` (new)
  - Tests covering the CLI command output.

## Tasks for This Session

Status: **To Do** / **In Progress** / **Completed**

1. **Analyse provider APIs and existing env usage** – **Completed**
   - Confirm which env vars already exist (`OPENAI_API_KEY`, `OPENAI_API_BASE`,
     `ANTHROPIC_API_KEY`, `ANTHROPIC_API_BASE`, `ANTHROPIC_API_VERSION`).
   - Check provider docs for the simplest model-list endpoints and required
     headers.

2. **Design minimal model-list service layer** – **Completed**
   - Define a shared `LlmModelInfo` type (e.g. `{ id: string; provider: 'openai'|'anthropic'; owned_by?: string; contextWindow?: number; }`).
   - Implement provider-specific functions in a new module:
     - `listOpenAiModels()`
     - `listAnthropicModels()`
   - Provide a small wrapper:
     - `listLlmModels(provider: 'openai' | 'anthropic'): Promise<LlmModelInfo[]>`.

3. **Web adapter endpoint: GET /api/llm/models** – **Completed**
   - Extend `AdapterDeps` in `src/web/server.ts`:
     - Add `listLlmModels?: (provider: string) => Promise<LlmModelInfo[]>`.
   - Implement `listLlmModels` inside `createLiveDeps` using the new service
     functions, reading provider from the parameter.
   - In the `dispatch` function, add:
     - `GET /api/llm/models?provider=openai|anthropic`
     - Validate `provider`; on invalid, return `400`.
     - On missing API key, return `500` with a clear message (e.g.
       `OPENAI_API_KEY is required to list models`).

4. **CLI command: gtm llm:models** – **Completed**
   - In `createProgram` (src/cli.ts), add:
     - Command: `llm:models`
     - Options: `--provider <provider>` (required, openai|anthropic).
   - Handler:
     - Calls `listLlmModels(provider)` and prints a JSON array to stdout
       (sorted by `id` for determinism).
     - On error, print a JSON error payload and set non-zero exit code.

5. **Tests for service layer** – **Completed**
   - New file: `tests/llmModels.test.ts`.
   - Test: `listOpenAiModels_maps_response_shape`
     - Mocks `fetch` to return a small `/v1/models` payload; ensures our helper
       returns normalized `LlmModelInfo[]` and uses `OPENAI_API_KEY` header.
   - Test: `listOpenAiModels_missing_api_key_throws`
     - Clears `OPENAI_API_KEY`; expects a thrown error mentioning the missing
       key.
   - Test: `listAnthropicModels_maps_response_shape`
     - Similar to OpenAI test, but verifying Anthropic headers and path.
   - Test: `listAnthropicModels_missing_api_key_throws`
     - Ensures missing `ANTHROPIC_API_KEY` results in a clear error.

6. **Tests for Web endpoint** – **Completed**
   - New file: `tests/web_llm_models_endpoint.test.ts`.
   - Test: `web_llm_models_endpoint_returns_openai_models`
     - Creates a mock `AdapterDeps` where `listLlmModels` returns a fixed list;
       hits `GET /api/llm/models?provider=openai` and asserts `200` + body.
   - Test: `web_llm_models_endpoint_rejects_unknown_provider`
     - Calls `GET /api/llm/models?provider=xyz` and expects `400`.

7. **Tests for CLI command** – **Completed**
   - New file: `tests/cliLlmModelsCommand.test.ts`.
   - Test: `cli_llm_models_prints_models_json`
     - Mocks `listLlmModels` to return a known list; runs `gtm llm:models --provider openai` via `createProgram`, captures `console.log`, and asserts JSON output and provider filter.
   - Test: `cli_llm_models_requires_provider_flag`
     - Runs the command without `--provider`; ensures it prints a usage or
       error message and exits non-zero.

8. **Manual verification** – **Completed**
   - Once implemented and tested:
     - Run: `pnpm cli llm:models --provider openai` and confirm a real list of
       models from your OpenAI account.
     - Run: `pnpm cli llm:models --provider anthropic` and confirm Anthropic
       models (where the API supports listing).
     - Optionally, hit `GET http://localhost:8787/api/llm/models?provider=openai`
       from the browser or curl to verify Web API output.

## Planned Functions

- `listOpenAiModels(): Promise<LlmModelInfo[]>`
  - Calls OpenAI's `/v1/models` (or equivalent) using `OPENAI_API_KEY` and
    `OPENAI_API_BASE`, returning normalized model metadata.

- `listAnthropicModels(): Promise<LlmModelInfo[]>`
  - Calls Anthropic's models endpoint using `ANTHROPIC_API_KEY` and
    `ANTHROPIC_API_BASE`/`ANTHROPIC_API_VERSION`, returning normalized model
    metadata.

- `listLlmModels(provider: 'openai' | 'anthropic'): Promise<LlmModelInfo[]>`
  - Dispatches to the provider-specific functions with simple validation on the
    provider string.

- `listLlmModelsWeb(provider: string): Promise<LlmModelInfo[]>`
  - Adapter-level wrapper used by `createLiveDeps` so that the Web dispatch
    layer does not need to know provider-specific details.

- `llmModelsCommand(provider: string): Promise<void>`
  - CLI handler invoked by `gtm llm:models`; prints the model list as JSON or a
    structured error message.

## Planned Tests (names + coverage)

- `listOpenAiModels_maps_response_shape`
  - Maps OpenAI `/models` response into normalized `LlmModelInfo[]`.

- `listOpenAiModels_missing_api_key_throws`
  - Throws clear error when `OPENAI_API_KEY` is not set.

- `listAnthropicModels_maps_response_shape`
  - Maps Anthropic models response into normalized `LlmModelInfo[]`.

- `listAnthropicModels_missing_api_key_throws`
  - Throws clear error when `ANTHROPIC_API_KEY` is not set.

- `web_llm_models_endpoint_returns_openai_models`
  - Web dispatch returns a 200 and the mocked model list.

- `web_llm_models_endpoint_rejects_unknown_provider`
  - Returns 400 when `provider` query param is invalid.

- `cli_llm_models_prints_models_json`
  - CLI prints JSON array of models for the chosen provider.

- `cli_llm_models_requires_provider_flag`
  - CLI exits with an error when `--provider` is missing.
