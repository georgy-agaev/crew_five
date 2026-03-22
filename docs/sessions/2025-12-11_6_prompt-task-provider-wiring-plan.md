# 2025-12-11 Session 6 – Prompts tab provider/model wiring

> Timestamp: 2025-12-11 15:57:52 UTC

## Overview

This session wires the **Provider** and **Model** selectors in the Prompts tab
(Task Configuration) into the actual configuration used by the web backend for
ICP coach flows and draft generation. The goal is that what you select per task
in Task Configuration (provider, model, prompt) is consistently reflected in the
API calls and LLM clients, without introducing new DB tables or legacy
fallbacks.

## Scope and Goals

- Make Task Configuration Provider/Model controls authoritative for Web flows by
  tying them to the existing `Settings` store used elsewhere.
- Ensure ICP coach endpoints and draft generation receive the provider/model
  from Task Configuration and use them when building LLM clients.
- Keep implementation minimal: reuse the existing model catalog and
  `buildChatClientForModel` factory; no new tables or complex persistence.

## Files Likely to Change

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Add mapping between UI tasks and settings provider keys.
  - Make Provider/Model selects read/write the shared `Settings` store.
  - Use those settings when calling coach and draft APIs.
- `web/src/pages/IcpDiscoveryPage.tsx`
  - Ensure ICP coach buttons on the dedicated ICP page use the same
    provider/model selection.
- `web/src/hooks/useSettingsStore.ts`
  - Types reused; no behaviour changes expected.
- `web/src/apiClient.ts`
  - Extend `generateIcpProfileViaCoach` / `generateHypothesisViaCoach` to accept
    optional `provider`/`model` and forward them.
- `src/web/server.ts`
  - In `createLiveDeps`:
    - Update `generateDrafts` to respect `provider`/`model` from the request by
      building a per-request `ChatClient` when necessary.
    - Update `generateIcpProfile` / `generateIcpHypothesis` to optionally build
      per-request `ChatClient`s from `provider`/`model` for `icp`/`hypothesis`
      tasks.
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Add helper tests for task→provider-key mapping or other small helpers.
- `web/src/apiClient.test.ts`
  - Add tests asserting provider/model are forwarded in coach helpers.
- `CHANGELOG.md`
  - Note that Prompts tab Provider/Model settings now drive Web LLM calls.

## Tasks

Status: **To Do**, **In Progress**, **Completed**

1. **Analyse current Prompts tab + settings wiring** – **Completed**
   - Confirm that Task Configuration currently only persists `taskPrompts` and
     that provider/model come from the Settings page and/or defaults in the
     model catalog.

2. **Design provider/model wiring strategy** – **Completed**
   - Use the existing `Settings` store as the single source of truth for
     provider/model per task.
   - Have Task Configuration controls update `settings.providers` for:
     - `icpDiscovery` → `providers.icp`
     - `hypothesisGen` → `providers.hypothesis`
     - `emailDraft` and `linkedinMsg` → `providers.draft` (for now).
   - For Web flows:
     - Draft generation: read `providers.draft` and pass `provider`/`model` to
       `/api/drafts/generate` (already partially done), and update the backend
       to use those values when building the LLM client.
     - ICP coach: read `providers.icp` / `providers.hypothesis`, send
       `provider`/`model` along with `promptId` to `/api/coach/icp` and
       `/api/coach/hypothesis`, and build per-request `ChatClient`s.

3. **Wire Prompts tab Provider/Model to settings store** – **Completed**
   - Add a local `settings` state in `PipelineWorkspaceWithSidebar` initialized
     from `loadSettings()`.
   - Implement a small helper `mapTaskToProviderKey(task)` that maps
     Task Configuration rows to `Settings.providers` keys.
   - Make the Provider and Model `<select>` elements controlled:
     - Provider: `value=settings.providers[key].provider`; update both state
       and `saveSettings` on change.
     - Model: `value=settings.providers[key].model` with model options that
       match the curated catalog (e.g., `gpt-4o`, `gpt-4o-mini`,
       `claude-3-5-sonnet`, `gemini-1.5-flash`).

4. **Propagate provider/model into coach and draft API calls** – **Completed**
   - In `PipelineWorkspaceWithSidebar` and `IcpDiscoveryPage`, when calling
     `generateIcpProfileViaCoach` / `generateHypothesisViaCoach`, read the
     appropriate `settings.providers[...]` entry and include `provider`/`model`
     in the payload.
   - Ensure `handleGenerateDrafts` continues to use `settings.providers.draft`
     when calling `triggerDraftGenerate`.
   - Update `web/src/apiClient.ts` signatures and tests so these new fields are
     forwarded to `/api/coach/icp` and `/api/coach/hypothesis`.

5. **Update backend to honor provider/model per request** – **Completed**
   - In `createLiveDeps.generateDrafts`, when `provider` or `model` is passed
     in the payload:
     - Resolve a model config via `resolveModelConfig({ provider, model, task:'draft' })`.
     - Build a per-request `ChatClient` via `buildChatClientForModel` and a
       short-lived `AiClient`, and call `generateDrafts` with the resolved
       provider/model.
     - Fall back to the existing `chatClient`/`aiClient` when nothing is
       specified or when the factory fails (preserving current behaviour).
   - In `createLiveDeps.generateIcpProfile` and `generateIcpHypothesis`, do the
     same per-request `ChatClient` construction when `provider`/`model` are
     provided, using tasks `icp` and `hypothesis` respectively.

6. **Tests and UI sanity checks** – **Completed**
   - Extend `web/src/pages/PipelineWorkspaceWithSidebar.test.ts` with a small
     helper test (e.g., `mapTaskToProviderKey`) to cover new logic.
   - Extend `web/src/apiClient.test.ts` to assert coach helpers forward
     `provider`/`model`.
   - Run `pnpm test -- web/src/pages/PipelineWorkspaceWithSidebar.test.ts web/src/apiClient.test.ts`.
   - Run `pnpm build` to ensure TS types remain consistent.
   - Use Playwright + Chrome DevTools to:
     - Set provider/model combinations on the Prompts tab.
     - Trigger ICP coach and draft generation and confirm the network payloads
       include the selected provider/model.

7. **Documentation and changelog updates** – **Completed**
   - Update this session file with task statuses (mark steps as Completed).
   - Add a bullet to `CHANGELOG.md` under `[0.1.68]` summarizing that the
     Prompts tab Task Configuration Provider/Model settings now drive Web LLM
     calls for ICP coach and draft generation.
