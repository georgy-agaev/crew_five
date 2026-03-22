# 2025-12-11 Session 9 – Provider/Model validation and UX honesty

> Timestamp: 2025-12-11 20:01:37 UTC

## Overview

The current Provider/Model dropdowns on the Prompts tab allow impossible
combinations (e.g., Anthropic + GPT-4o) and the backend silently falls back to
a default model in some cases. This session will:

- Constrain Provider/Model selections to valid pairs from the model catalog.
- Ensure invalid provider/model combinations are surfaced as clear errors, not
  silent fallbacks.
- Make provider/model usage visible and honest in both Web and CLI flows.

## Scope and Goals

- Use `src/config/modelCatalog.ts` as the single source of truth for valid
  provider/model pairs.
- Filter Model dropdown options based on the selected Provider.
- Validate provider/model on the backend using `resolveModelConfig` and surface
  its errors instead of swallowing them.
- Keep changes minimal: do not introduce new configuration tables.

## Files Likely to Change

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Change Task Configuration UI so that Model options depend on Provider and
    only list catalog-supported models.
- `web/src/pages/SettingsPage.tsx`
  - Optionally reuse the same filtered model logic for Settings.
- `src/config/modelCatalog.ts`
  - Export helper functions for listing models per provider.
- `src/web/server.ts`
  - Remove silent catch around `resolveModelConfig` in per-request ChatClient
    creation; instead, propagate errors.
- `tests/modelCatalog.test.ts`
  - Extend tests to cover new helpers.
- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Tests for Provider→Model filtering behaviour.

## Tasks

1. **Extract catalog helpers for UI** – **Completed**
   - Add `getModelsForProvider(provider)` in `modelCatalog.ts`.
   - Ensure it returns only supported `{ provider, model }` combinations.

2. **Filter Model dropdown by Provider in Prompts tab** – **Completed**
   - In `PipelineWorkspaceWithSidebar.tsx`, for each Task Configuration row:
     - Use `getModelsForProvider(selectedProvider)` to populate Model options.
     - When Provider changes, if the current model is not valid for that
       provider, reset it to a sensible default.

3. **Reuse filtering in Settings page** – **Completed**
   - In `SettingsPage.tsx`, replace hard-coded `modelOptions` with catalog-based
     options per provider; keep task labels unchanged.

4. **Stop swallowing provider/model errors in backend** – **Completed**
   - In `src/web/server.ts` per-request ChatClient creation (drafts and
     coach endpoints):
     - Call `resolveModelConfig` and `buildChatClientForModel` without
       silently catching errors.
     - Allow errors to propagate so that the Web API returns a clear 500 with
       the underlying message.

5. **Tests** – **Completed**
   - `getModelsForProvider_returns_only_supported_pairs`
     - Ensures each returned entry matches a catalog entry.
   - `prompts_tab_filters_models_by_selected_provider`
     - Asserts that selecting Anthropic only shows Anthropic models, etc.
   - `settings_page_filters_models_by_selected_provider`
     - Same behaviour on Settings page.
   - `drafts_endpoint_errors_on_invalid_provider_model`
     - With a fake provider/model, verify a clear error is surfaced and no
       ChatClient is constructed.

6. **Manual UX check** – **Completed**
   - In the browser:
     - Try to select Anthropic and confirm that only Anthropic models appear.
     - Try to misconfigure provider/model and confirm the Web API responds with
       a descriptive error, not a silent fallback, when generating drafts or
       running ICP/Hypothesis coach.
