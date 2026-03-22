# 2025-12-01 – Web UI Model & Prompt Wiring Plan

> Timestamp (UTC): 2025-12-01T22:20:24Z
> Goal: Wire model/provider selection (Session 3) and prompt selection/registry (Session 4) into the Web UI tabs, surface coach prompts for ICP/HYP generation, and relocate draft generation to Segments & Enrichment. No legacy fallbacks.

## Overview
- Tab 1 (ICP & Coach): add coach-driven generation actions for ICP profiles and hypotheses using curated prompts; show selections and generated artifacts. Model/provider selection honored from settings. No draft generation here.
- Tab 2 (Segments & Enrichment): keep segment filters/snapshot/enrichment; add draft generation (requires finalized segment v1, campaign, ICP/HYP, prompt selection). Thread provider/model and prompt IDs into draft requests.
- Prompt registry: expose list/create and selection UI; allow per-step prompt choices (icp_profile, hypothesis, draft) via bundled or per-step picks; persist to campaign metadata for draft generation.

## Files to Touch
- `web/src/pages/IcpDiscoveryPage.tsx` – add coach-generate ICP/HYP buttons using prompts; show generated output; remove draft generation from this tab.
- `web/src/pages/WorkflowZeroPage.tsx` – keep segment flow; move draft generation here with ICP/HYP selection and prompt selection per step; show provider/model applied.
- `web/src/pages/PromptRegistryPage.tsx` (new or extend if present) – list/create prompt entries; filter by step; allow selection for campaigns.
- `web/src/pages/CampaignsPage.tsx` (or shared selector component) – prompt bundle/step overrides; apply to campaign metadata.
- `web/src/apiClient.ts` – endpoints for prompt registry fetch/create, campaign prompt update, coach ICP/HYP generation calls.
- `web/src/hooks/useSettingsStore.ts` and `web/src/pages/SettingsPage.tsx` – ensure provider/model per task available to UI flows.
- Tests: `web/src/apiClient.test.ts`, `web/src/pages/*test*.tsx` for new behaviours.

## Planned Functions (1–3 sentences each)
- `generateIcpViaCoach(input)` / `generateHypothesisViaCoach(input)` (apiClient + server routes): call coach prompts to create ICP profile / hypothesis records and return created rows.
- `fetchPromptRegistry` / `createPromptRegistryEntry` (apiClient): list/create prompt entries (id/version/step/rollout_status/description).
- `updateCampaignPrompts(campaignId, bundle)` (apiClient): persist prompt bundle/per-step overrides for campaign metadata.
- `DraftGenerationRequest` enrichment on Web: include `icpProfileId`, `icpHypothesisId`, `provider`, `model`, and selected prompt IDs; enforce finalized segment v1.

## Planned Tests (5–10 words each)
- `api_client_generate_icp_and_hypothesis_calls_coach_endpoints` – coach endpoints invoked and return rows.
- `api_client_prompt_registry_round_trip` – list/create entries via client.
- `campaign_prompt_selector_saves_bundle_and_overrides` – UI saves prompt bundle/step overrides.
- `workflow0_draft_generation_requires_prompts_and_icp` – UI blocks drafts without ICP/HYP and prompts.
- `icp_tab_generates_icp_and_hypothesis_via_coach` – UI triggers coach generation and renders results.

## Tasks
- To Do:
  - Closed: coach ICP/HYP endpoints/UI, Segments tab draft generation with prompts/ICP, prompt registry list/create + selector, and related tests are delivered; no remaining To Dos here.
- Completed:
  - Added coach ICP/HYP generation endpoints (web server) and apiClient helpers; ICP tab now uses coach buttons to generate ICP/HYP and removed draft generation from Tab 1.
  - Segments & Enrichment tab requires prompt selection for draft generation and threads provider/model/prompt into requests.
  - Prompt registry create route + apiClient helper added; registry selection dropdown included on draft generation panel; session UI doc cross-referenced.
  - Mock web adapter now implements coach ICP/HYP, prompt registry, segments/enrichment so UI buttons work in dev mode.
  - Tests updated (server routes, apiClient coach/prompt registry, WorkflowZero guards); full suite passing (`pnpm test --watch=false`).
