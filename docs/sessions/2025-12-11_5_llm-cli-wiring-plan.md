# 2025-12-11 Session 5 – CLI LLM wiring and prompt usage

> Timestamp: 2025-12-11 14:48:25 UTC

## Overview

This session focuses on wiring the CLI into the new LLM client layer so that CLI draft
and ICP coach commands use the same OpenAI/Anthropic chat clients as the web adapter.
We will implement only the minimal functionality needed to have real LLM-backed
behaviour in CLI flows, reusing existing abstractions and keeping the prompts
and model selection logic consistent with the current design.

## Scope and Goals

- Use the shared `buildChatClientForModel` + `resolveModelConfig` pipeline in the CLI.
- Keep behaviour identical when LLM credentials are missing (stub client fallback).
- Ensure coach-related CLI commands (`icp:coach:*`) receive a real `ChatClient`.
- Add focused tests that exercise `runCli` wiring without hitting external services.
- Do not introduce new persistence tables or alternate legacy fallbacks.

## Files Likely to Change

- `src/cli.ts` – create a real `ChatClient` in `runCli` via the provider/model catalog.
- `src/config/modelCatalog.ts` – reused as-is; no changes expected beyond imports.
- `src/services/providers/buildChatClient.ts` – reused; no functional changes expected.
- `tests/cliChatClient.test.ts` (new) – tests for CLI wiring and stub fallback.
- `CHANGELOG.md` – note CLI LLM wiring under the latest version.
- `docs/sessions/2025-12-11_5_llm-cli-wiring-plan.md` (this document) – keep
  To Do vs Completed status updated during the session.

## Tasks

Status legend: **To Do**, **In Progress**, **Completed**

1. **Analyse current CLI and LLM wiring** – **Completed**
   - Confirm how `runCli`, `draftGenerateHandler`, and coach commands currently
     construct and use `ChatClient` and `AiClient`.

2. **Design CLI LLM wiring approach** – **Completed**
   - Reuse the web adapter pattern: resolve a default draft model via
     `resolveModelConfig({ task: 'draft' })` and call `buildChatClientForModel`.
   - Fall back to the existing stub `ChatClient` when credentials or config are
     missing, to keep the CLI usable in offline/test scenarios.
   - Keep `draft:generate --provider/--model` flags as metadata inputs only for
     now; full per-command model switching can be a later enhancement.

3. **Implement `runCli` ChatClient creation** – **Completed**
   - Replace the inline stub `chatClient` in `runCli` with logic that:
     1. Resolves the default model config for the `draft` task.
     2. Tries `buildChatClientForModel`, catching errors.
     3. Falls back to the existing stub implementation on error.
   - Pass the resulting `chatClient` (and a new `AiClient(chatClient)`) into
     `createProgram` so all CLI commands share the same LLM client.

4. **Add CLI wiring tests (TDD)** – **Completed**
   - New file: `tests/cliChatClient.test.ts`.
   - Test: `runCli_uses_factory_chat_client_when_available`
     - Mock `buildChatClientForModel` to return a sentinel `ChatClient`.
     - Spy on `createProgram` to assert it receives that `ChatClient`.
   - Test: `runCli_falls_back_to_stub_chat_client_on_factory_error`
     - Mock `buildChatClientForModel` to throw.
     - Spy on `createProgram` to assert it is called with a non-null
       `chatClient` whose `complete` method produces stub-like JSON.

5. **Run unit tests and build** – **Completed**
   - `pnpm test` – ensure new and existing tests pass.
   - `pnpm build` – verify TypeScript compilation with the new imports.

6. **High-level E2E sanity (no CLI rewrite)** – **Completed**
   - Use existing web adapter + UI flows for a quick regression check:
     - Confirm draft generation still works from the web with real or stub LLMs.
   - CLI E2E (manual / light): run `pnpm cli draft:generate --dry-run` in an
     environment with and without LLM keys to verify it executes without
     throwing and respects the new wiring.

7. **Documentation and changelog updates** – **Completed**
   - Update this session file with task statuses (To Do → Completed).
   - Add a short note to `CHANGELOG.md` under the latest version:
     - "Wire CLI draft and coach commands into shared LLM clients (OpenAI/Anthropic).")

## Planned Functions and Behaviour

- `runCli(argv?: string[]): Promise<void>`
  - Load environment and Supabase client, resolve a default model configuration
    for the draft task, build a `ChatClient` via the shared factory with a
    stub fallback, create an `AiClient`, and run the Commander program.

- `buildStubChatClient(): ChatClient` (inline or helper inside `runCli`)
  - Provide the existing JSON-based stub behaviour for email drafts and simple
    ICP coach responses, used when real LLM configuration is unavailable.

## Planned Tests

- `runCli_uses_factory_chat_client_when_available`
  - Ensures `runCli` constructs the CLI program with the `ChatClient` returned
    by `buildChatClientForModel` when the factory succeeds.

- `runCli_falls_back_to_stub_chat_client_on_factory_error`
  - Ensures `runCli` still passes a working stub `ChatClient` to
    `createProgram` when the factory throws (e.g., missing API keys).
