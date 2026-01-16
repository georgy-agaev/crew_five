# 2025-12-01 – Model/Provider Selection Plan

> Timestamp (UTC): 2025-12-01T13:27:08Z  
> Goal: let users choose the AI provider (OpenAI/Anthropic/Gemini) and model
> from a recommended list, surfaced via CLI/Web with safe defaults and clear
> guidance. No legacy fallbacks.

## Overview
- Add provider + model selection with recommended defaults; wire through CLI and Web settings.
- Persist selections per campaign (draft generation) and for global defaults.
- Expose a curated, versioned recommendation list; avoid free-text model IDs.

## To Do
- Provider/model config surface (task-based)
  - Files: `src/config` (new helper or extend existing env/config), `src/services/aiClient.ts`, `src/commands/draftGenerate.ts`, `src/cli.ts`, `tests/cli.test.ts`, `tests/draftCommand.test.ts`.
  - Functions:
    - `resolveModelConfig({ provider, model, task })` – returns validated provider/model from a curated map with defaults per task (assistant/icp/hypothesis/draft).
    - `withModelSelection(aiClient, config)` – wrapper that injects provider/model metadata into draft generation requests/responses.
  - Tests:
    - `draft_generate_accepts_provider_model_flags_and_threads_metadata` – CLI flags set provider/model and reach drafts metadata.
    - `resolve_model_config_returns_task_defaults_on_missing_flags` – defaults per task when not specified.

- Recommendation catalog
  - Files: `src/config/modelCatalog.ts`, `tests/modelCatalog.test.ts`.
  - Functions:
    - `getRecommendedModels()` – returns curated list (OpenAI/Anthropic/Gemini) with tags for cost/latency, per task.
    - `assertSupportedModel(provider, model)` – throws if model not in catalog.
  - Tests:
    - `get_recommended_models_includes_expected_providers_and_models` – verifies catalog content.
    - `assert_supported_model_rejects_unknown_model` – rejects invalid inputs.

- Web UI settings for provider/model
  - Files: `web/src/hooks/useSettingsStore.ts`, `web/src/pages/SettingsPage.tsx`, `web/src/apiClient.test.ts` (if needed), `web/src/pages/*tests*`.
  - Functions:
    - `Settings.provider` / `Settings.model` – add to store; persist; validate against catalog.
    - `SettingsPage` controls to pick provider/model from curated options; show recommendation note.
  - Tests:
    - `settings_store_persists_provider_and_model` – state round-trips with defaults.
    - `settings_page_allows_selecting_provider_and_model` – UI renders options and saves selection.

- Campaign-level selection
  - Files: `src/services/campaigns.ts` (metadata or fields), `src/services/drafts.ts` (metadata propagation), `tests/campaigns.test.ts`, `tests/drafts.test.ts`.
  - Functions:
    - `updateCampaign`/`createCampaign` accept provider/model/task metadata.
    - Draft writes include `provider`/`model` metadata for analytics.
  - Tests:
    - `campaign_create_persists_provider_model_metadata` – creation stores selections.
    - `drafts_include_provider_model_metadata` – draft metadata carries provider/model for analytics.

## Completed
- Model catalog added with task-based defaults and validation (`src/config/modelCatalog.ts`, `tests/modelCatalog.test.ts`).
- Draft generation accepts provider/model flags, resolves defaults per task, and persists provider/model into draft metadata (`src/commands/draftGenerate.ts`, `src/services/drafts.ts`, `src/cli.ts`, tests updated).
- Web UI: settings store and settings page now expose curated provider/model dropdowns per task; draft generation calls in Drafts/Campaigns/WorkflowZero/ICP Discovery use selected models (`web/src/hooks/useSettingsStore.ts`, `web/src/pages/SettingsPage.tsx`, `web/src/pages/*.tsx`, `web/src/apiClient.ts`, tests updated).
