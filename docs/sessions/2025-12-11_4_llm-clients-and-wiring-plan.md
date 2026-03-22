# 2025-12-11 Session – Real LLM Clients (OpenAI + Anthropic)

> Timestamp: 2025-12-11T14:05:00

## Short Overview

We will replace the current stub-only ChatClient usage with real HTTP-backed OpenAI and Anthropic clients and wire them into both the CLI and Web adapter. The goal for this session is to support real LLM calls for ICP/Hypothesis coach flows and draft generation, driven by the existing provider/model configuration, while keeping the prompts tab responsible for prompt IDs.

## Scope – Only What We Need Now

- Implement **OpenAI** and **Anthropic** ChatClient implementations for JSON-style completions.
- Add a small factory that chooses a concrete ChatClient based on provider/model.
- Update the **CLI** to use real LLM clients for `draft:generate` and ICP coach commands when API keys are present.
- Update the **Web adapter (live mode)** to use the same factory so the web UI ICP/Hypothesis coach and draft generation also hit real models.
- Keep prompt handling as-is: prompt IDs come from the Prompts tab, provider/model from the curated model catalog + user settings.

## Files to Change

- `src/services/chatClient.ts`  
  - Extend with provider-aware ChatClient types if needed (still keeping a simple `complete` method for callers).

- `src/services/providers/OpenAiChatClient.ts` (new)  
  - Concrete `ChatClient` for OpenAI chat completions.

- `src/services/providers/AnthropicChatClient.ts` (new)  
  - Concrete `ChatClient` for Anthropic messages API.

- `src/services/providers/buildChatClient.ts` (new)  
  - Factory that picks OpenAI vs Anthropic based on `{ provider, model }`.

- `src/config/modelCatalog.ts`  
  - Ensure model catalog entries and `resolveModelConfig` work cleanly with the new factory.

- `src/commands/draftGenerate.ts`  
  - Ensure provider/model selection is threaded correctly into the AI client usage.

- `src/cli.ts`  
  - Replace the stub `chatClient` in `runCli` with a provider/model-based client built via the new factory.

- `src/web/server.ts`  
  - Replace the stub `chatClient` in live adapter mode with the provider-based client; keep test/mock modes using in-memory stubs.

- Tests: `tests/modelCatalog.test.ts`, `tests/aiClient.test.ts`, `tests/coach.test.ts`, `src/web/server.test.ts`, and new provider-specific tests.

## Implementation Steps

1. **Define provider-aware ChatClient factory**  
   - Create a small `buildChatClientForModel` helper that takes `{ provider, model }` and returns a `ChatClient` backed by OpenAI or Anthropic.
   - Use existing model catalog validation to ensure only supported provider/model pairs are accepted.

2. **Implement OpenAI ChatClient**  
   - Implement `OpenAiChatClient` that calls the OpenAI Chat Completions endpoint with `response_format: { type: 'json_object' }` and returns the raw JSON string for downstream parsing.  
   - Read `OPENAI_API_KEY` (and optional base URL/model overrides) from env; throw a clear error if missing.

3. **Implement Anthropic ChatClient**  
   - Implement `AnthropicChatClient` that calls Anthropic's messages API; map our `ChatMessage[]` to Anthropic's `messages` format and return the textual content as a JSON string.  
   - Read `ANTHROPIC_API_KEY` (and base URL/version) from env; throw a clear error if missing.

4. **Update CLI to use real ChatClients**  
   - In `runCli`, use `resolveModelConfig` with the task-specific settings (from env or defaults) to obtain `{ provider, model }` for assistant/ICP/hypothesis/draft.  
   - Build a `chatClient` via `buildChatClientForModel` and pass it to `AiClient` and coach commands instead of the current stub.

5. **Update Web adapter (live mode) to use real ChatClients**  
   - In `createLiveDeps`, choose a model for ICP/Hypothesis/Drafts (using `resolveModelConfig` and/or defaults) and build `chatClient` via the same factory.  
   - Keep mock adapter behaviour for tests; only the live adapter uses real OpenAI/Anthropic HTTP calls.

6. **Thread provider/model selection from settings where needed**  
   - For **draft generation**, we already pass `provider`/`model` to `generateDrafts`; ensure these are also used to create the ChatClient in CLI and web.  
   - For **ICP/Hypothesis coach**, pick provider/model from `Settings.providers.icp` / `Settings.providers.hypothesis` or corresponding env defaults and pass into the factory.

7. **Add and update tests**  
   - Add unit tests for `buildChatClientForModel`, `OpenAiChatClient`, and `AnthropicChatClient` that mock `fetch` and assert correct request payloads and error handling.  
   - Adjust existing coach/web server tests to confirm that when provider/model are resolved, the correct client is chosen and the response is still shaped as `{ jobId, profile }` / `{ jobId, hypothesis }`.

## Functions (names and roles)

- `buildChatClientForModel(config)` (`src/services/providers/buildChatClient.ts`)  
  Given `{ provider, model }`, returns an instance of `OpenAiChatClient` or `AnthropicChatClient`; throws if the provider is unsupported or required env vars are missing.

- `OpenAiChatClient` (`src/services/providers/OpenAiChatClient.ts`)  
  Implements `ChatClient.complete(messages)` by calling OpenAI's chat completion endpoint with JSON output and returning the assistant content as a string.

- `AnthropicChatClient` (`src/services/providers/AnthropicChatClient.ts`)  
  Implements `ChatClient.complete(messages)` by calling Anthropic's messages API and returning the text content as a string.

- `resolveModelConfig(input)` (`src/config/modelCatalog.ts`, existing)  
  Returns a validated `{ provider, model }` pair for a given task, used to choose the appropriate ChatClient.

- `draftGenerateHandler(client, aiClient, options)` (`src/commands/draftGenerate.ts`, existing)  
  Ensures drafts are generated with provider/model coming from the model catalog and that the chosen provider is reflected in both metadata and the ChatClient selection.

- `runCli(argv)` (`src/cli.ts`)  
  Loads env, initializes Supabase, builds the provider-specific ChatClient via the factory, wraps it in `AiClient`, and passes it into all CLI commands that need LLMs.

- `createLiveDeps()` (`src/web/server.ts`)  
  Builds the live adapter dependencies, including an `AiClient` backed by a real ChatClient selected via the factory so web ICP/Hypothesis coach and draft generation use real LLMs.

## Tests (names and behaviours)

- `buildChatClientForModel_selects_openai_client`  
  Returns OpenAI client when provider is `openai`.

- `buildChatClientForModel_selects_anthropic_client`  
  Returns Anthropic client when provider is `anthropic`.

- `openai_chat_client_sends_expected_payload`  
  Mocks fetch; asserts URL, headers, messages, and JSON format.

- `anthropic_chat_client_sends_expected_payload`  
  Mocks fetch; asserts URL, headers, messages, and JSON format.

- `runCli_uses_real_chat_client_when_keys_present`  
  With env keys set, CLI builds provider-based ChatClient instead of stub.

- `web_adapter_uses_real_chat_client_in_live_mode`  
  Live adapter calls factory and uses real ChatClient for ICP coach/drafts when provider env keys are present; tests inject stub chat clients to avoid network.

- `draft_generate_handler_threads_provider_and_model_correctly`  
  Draft generation passes resolved provider/model through to metadata and factory.
