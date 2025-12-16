# Changelog

All notable changes to this project will be documented in this file.

## [0.1.74] - 2025-12-15
### Changed
- Updated `docs/web_ui_endpoints.md` to include the `/api/services`, `/api/llm/models`, and
  `/api/inbox/messages` web adapter endpoints, refreshed the Settings and Pipeline workspace screen
  mappings to reflect live usage of these APIs, and bumped the document version to `v0.2` so the
  Web UI endpoint catalog remains in sync with `src/web/server.ts` and `web/src/apiClient.ts`.
 - Added an explicit cross-link from `docs/web_ui_requirements.md` to `docs/web_ui_endpoints.md` so
   readers can jump directly from behaviour/navigation requirements to the concrete Web adapter
   endpoint map.
 - Extended `AGENTS.md` with a Web adapter rule: any creation, modification, or removal of HTTP
   endpoints in `src/web/server.ts` (or their clients in `web/src/apiClient.ts`) must be accompanied
   by an update to `docs/web_ui_endpoints.md` to keep the catalog authoritative.

## [0.1.73] - 2025-12-13
### Added
- Pipeline segment step now surfaces a “Review candidates in ICP Discovery” call-to-action whenever an Exa discovery run has been persisted, using `hasPersistedDiscoveryRun` and `openIcpDiscoveryForLatestRun` to deep-link into the `?view=icp-discovery` web view without adding a new router.  
- `IcpDiscoveryPage` now hydrates `discoveryRunId`, ICP profile, and hypothesis selection from the latest persisted discovery record and auto-loads candidates once on deep-linked visits, while keeping the manual “Load candidates” path unchanged for hand-typed run ids.  
- Parallel.ai enrichment now uses a minimal non-throwing stub client built by `buildParallelClientFromEnv`; `researchCompany` / `researchContact` return `{ provider: 'parallel', summary, sources }`, and the `parallel` adapter in `createEnrichmentProviderRegistry` maps this into a stable `{ provider, entity, company_id/contact_id, summary, sources, payload }` shape for `runSegmentEnrichmentOnce`.
### Changed
- Updated session doc `docs/sessions/2025-12-13_4_exa-discovery-multisource-and-icp-deep-interactive-plan.md` to record the new Exa discovery UX behaviour, the Parallel enrichment stub, and the first ICP Deep Interactive helpers (`resolveCoachRunMode` / `applyCoachResultToState` wired into `handleAiSend`), with further UI toggles deferred to a follow-up session.

## [0.1.72] - 2025-12-13
### Added
- Interactive ICP/Hypothesis coach refinements in the Pipeline Workspace AI Assistant: new helpers
  `appendInteractiveCoachMessage`, `buildInteractiveIcpPrompt`, and `buildInteractiveHypothesisPrompt` now
  construct `userPrompt` strings that combine the latest ICP/hypothesis summaries with the user’s message, and
  transcript entries are tagged with step/entity id while being trimmed to the most recent messages for
  readability.  
- Exa discovery entry improvements in the Pipeline segment step: `handleRunDiscovery` now persists the latest
  discovery metadata via `persistLatestDiscoveryRun`, and the **EXA Web Search** and **Search Database** tiles
  either trigger a discovery run or open the AI Assistant with a guided prompt instead of remaining visual-only.  
### Changed
- Enrichment provider registry tests now assert that unknown providers raise a coded
  `ENRICHMENT_PROVIDER_UNKNOWN` error, documenting the error surface for future Parallel/Firecrawl/Anysite
  routing without changing existing Exa behaviour.

## [0.1.71] - 2025-12-13
### Added
- IcpDiscoveryPage now includes a lightweight “Coach conversation (latest runs)” panel that records user prompts and assistant summaries for ICP and Hypothesis coach runs, using the same phase-derived summary helpers as the Pipeline workspace; helper functions `appendDiscoveryChatMessage`, `formatIcpSummaryForChatDiscovery`, and `formatHypothesisSummaryForChatDiscovery` are covered by new tests and keep formatting logic DRY by delegating to the shared Pipeline helpers.

## [0.1.70] - 2025-12-12
### Changed
- Normalized OpenAI and Anthropic base URLs for both `/models` listing and chat-completion endpoints via `normalizeOpenAiBaseUrl` / `normalizeAnthropicBaseUrl`, reducing 404s when using custom proxies or non-`/v1` bases and aligning the ChatClient tests with the new behaviour.
- Relaxed `resolveModelConfig` so explicit `provider`/`model` pairs from the Web UI or CLI are accepted without requiring a catalog entry, while still providing curated defaults when flags are omitted; this ensures Settings and Prompts tab selections map directly to the provider APIs without hidden overrides.
- Updated live web adapter coach endpoints to always honour `provider`/`model` flags (using `buildChatClientForModel`) for ICP and Hypothesis coach runs instead of silently falling back to the default client when configuration is present but not in the catalog.
- Wired ICP discovery page coach actions to forward both provider/model and the selected Prompt Registry IDs (`taskPrompts.icpDiscovery`/`taskPrompts.hypothesisGen`), so ICP/Hypothesis “Chat with AI” now uses the same prompt + model configuration as the Pipeline workspace.
- Extended the Pipeline Workspace “Current Configuration” sidebar to render ICP and Hypothesis summaries via `buildIcpSummaryFromProfile` / `buildHypothesisSummaryFromSearchConfig`, preferring `icp_profiles.phase_outputs` and `icp_hypotheses.search_config.phases` when present and falling back to existing criteria, with helper-level Vitest coverage and a Playwright-driven browser run validating quick ICP/hypothesis creation and LLM connectivity.

## [0.1.69] - 2025-12-11
### Added
- LLM model listing helpers in `src/services/providers/llmModels.ts` plus a new CLI command `gtm llm:models --provider openai|anthropic` and web endpoint `GET /api/llm/models?provider=…`, providing a concrete proof of OpenAI/Anthropic connectivity using the configured API keys.
- ICP coach Express mode now returns strongly-typed phase payloads for profiles and hypotheses; `createIcpProfileViaCoach` maps these into structured `company_criteria`/`persona_criteria` and a new `icp_profiles.phase_outputs` snapshot column, while hypotheses persist phase 4–5 offers/critiques under `icp_hypotheses.search_config.phases`.
- Web Pipeline Workspace now surfaces provider `/models` errors (for example, OpenAI/Anthropic 401/404 responses) directly in the "Live LLM models" panel via `mapLlmModelsErrorMessage`, making misconfigured keys or base URLs easier to troubleshoot.
- ICP and Hypothesis coach flows now consume `prompt_registry.prompt_text` as the system prompt when a `promptId` is configured, and use the free-text message from the UI as the user prompt; prompt resolution errors (missing row or `prompt_text` column) surface as clear HTTP/CLI errors instead of falling back silently.
- Web API client and Pipeline/ICP pages now forward `userPrompt` and `promptId` fields into `/api/coach/icp` and `/api/coach/hypothesis`, so the Prompts tab Task Configuration directly drives the LLM messages used for ICP/Hypothesis generation.
### Changed
- Provider/Model dropdowns in the Settings modal and Prompts tab Task Configuration now derive their options from the shared model catalog in `src/config/modelCatalog.ts`, filtering models per provider/task and automatically correcting invalid persisted combinations to the nearest valid default.
- Live web adapter `createLiveDeps` continues to fall back to a stub ChatClient when provider env is missing, but per-request overrides for coach/draft generation now rely on the curated model catalog and no longer introduce new silent fallbacks when provider/model flags are misconfigured.

## [0.1.68] - 2025-12-11
### Changed
- Prompts tab creation flows are now step-less in the Web UI: both the dedicated `PromptRegistryPage` and the inline “New prompt entry” form in the Pipeline workspace create registry rows without requiring a `step` value, while still working against environments where the `prompt_registry.step` column is absent.
- Task Configuration on the Prompts tab now uses a flat list of prompts for all tasks (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message); selections are stored per task in local state instead of relying on step-based active prompts.
- Web coach flows (`icp`/`hypothesis`) and draft generation now pass the Task Configuration selections through as explicit prompt IDs (`promptId` / `explicitCoachPromptId`), and `generateDrafts` prefers these explicit IDs over step-based resolution so backend behaviour matches the Prompts tab configuration without hidden fallbacks.
- Task Configuration prompt selections are now persisted per browser via the existing `useSettingsStore` (`localStorage`): after reloading the page, each task’s selected prompt ID is restored and continues to drive coach and draft flows.
- Web adapter coach endpoints `/api/coach/icp` and `/api/coach/hypothesis` now return `{ jobId, profile }` / `{ jobId, hypothesis }` to match existing tests and the Web API client expectations, fixing a runtime `Cannot read properties of undefined (reading 'id')` error in AI-assisted ICP/Hypothesis flows after the `jobs_type_check` constraint was updated to allow `icp` jobs.
- Added first-class OpenAI and Anthropic ChatClients plus a `buildChatClientForModel` factory; the live web adapter now uses the curated model catalog to select a provider/model and build a real LLM client when API keys are present, while tests inject stub chat clients to avoid network calls.
- CLI `runCli` now builds its `ChatClient` via the same model catalog + `buildChatClientForModel` pipeline as the web adapter, with a JSON stub fallback when provider env is missing; helper tests cover both real and stub paths.
- Prompts tab Task Configuration `Provider`/`Model` selectors now read/write the shared Settings store and are used for ICP coach and draft generation: the web adapter builds per-request chat clients based on the selected provider/model when those values are passed in, while unsupported providers (for now, Gemini) surface as runtime errors instead of silently falling back.

## [0.1.67] - 2025-12-10
### Changed
- Prompts tab Task Configuration now reads from the live prompt registry: prompt dropdowns for ICP Discovery, Hypothesis Generation, and Email Draft are populated from `prompt_registry` by step, and the "Active prompt" labels under each task reflect the current active prompt per step.
- Selecting a prompt in Task Configuration or clicking "Set active" in the Prompt Registry table now use a shared helper that calls `/api/prompt-registry/active` and refreshes the registry, keeping task summaries and the registry table in sync without adding new schema or legacy fallbacks.

## [0.1.66] - 2025-12-09
### Changed
- ICP and Hypothesis “Chat with AI” in the Pipeline workspace now resolve the active prompts for `icp_profile` and `icp_hypothesis` from the prompt registry and pass the selected `promptId` through `/api/coach/icp` and `/api/coach/hypothesis`, so coach runs are explicitly tied to Prompts tab configuration.
- The workspace Prompts tab has been wired to the live prompt registry: it loads entries via `/api/prompt-registry`, surfaces rollout status labels, and adds a “Set active” action per prompt that calls `/api/prompt-registry/active` and refreshes the list; draft generation continues to use the active `draft` prompt as before.
- Prompt reference documentation now describes how ICP coach flows use `promptId` from the registry, aligning Web UI, coach services, and analytics with a single prompt-selection mechanism.
- Prompt registry endpoints now normalize rows so the UI works with human `coach_prompt_id` values (not internal UUIDs), and the Prompts tab includes an inline “Create prompt” form that posts to `/api/prompt-registry` and immediately refreshes the table so new `icp_profile`, `icp_hypothesis`, and `draft` prompts can be created without leaving the workspace.
- Live web adapter ICP coach helpers (`generateIcpProfile` / `generateIcpHypothesis`) and coach services now thread optional `promptId` metadata into job payloads, allowing analytics and future tooling to attribute ICP/hypothesis generations to specific prompt variants.
- The inline Create Prompt form now persistently stores `prompt_text` in a new `prompt_registry.prompt_text` column so the textarea saves instead of being a stub, and the compact left sidebar centers the `P/I/A/PR` labels so the collapsed tabs feel aligned.

## [0.1.65] - 2025-12-09
### Added
- Pipeline workspace (`web/src/pages/PipelineWorkspaceWithSidebar.tsx`) is now wired end-to-end for ICP → Hypothesis → Segment → Enrichment → Draft → Send, using the live web adapter endpoints for ICP, hypotheses, segments, enrichment, draft generation (`POST /api/drafts/generate`), campaigns (`GET /api/campaigns`), Smartlead preview (`GET /api/smartlead/campaigns`, `POST /api/smartlead/send`), and the unified services inventory (`GET /api/services`); the UI remains aligned with the original design but now reflects all `.env`-backed providers.
- Web docs (`docs/options/Pipeline Workspace - API Endpoints Inventory.md`) updated to document the implemented services inventory, draft, and Smartlead preview wiring for the pipeline workspace, clarifying that Send runs in dry-run/preview mode from the UI while full delivery remains CLI/Smartlead-dashboard driven.

## [0.1.64] - 2025-12-06
### Changed
- `enrich:run` CLI now supports `--error-format text|json` and is wrapped with shared `wrapCliAction` error handling, so unknown or misconfigured enrichment providers (for example, an invalid `--provider` value) surface as structured `{ ok:false, error:{ code,message } }` payloads instead of unhandled exceptions.
- Extensibility docs (`public-docs/EXTENSIBILITY_AND_CONNECTORS.md`) updated to describe `enrich:run --provider` routing through the enrichment provider registry and the use of stable error codes like `ENRICHMENT_PROVIDER_UNKNOWN` for automation.
 - ICP discovery Web UI “Pre-import review” panel now disables “Promote approved candidates” when no segment or approvals are selected, shows a clear empty state when a discovery run returns zero candidates, and surfaces a richer promotion summary including run id and segment name; a `Run discovery` control has been added next to the Exa query plan in preparation for triggering discovery directly from the UI. 
 - `docs/web_ui_endpoints.md` added as a Web adapter reference, cataloguing all `/api` endpoints in `src/web/server.ts` and mapping them to the Web UI screens and `web/src/apiClient.ts` helpers.

## [0.1.63] - 2025-12-05
### Added
- ICP discovery promotion helper `promoteIcpDiscoveryCandidatesToSegment` wired into the CLI (`icp:discover --promote --segment-id ... --candidate-ids ...`) and web adapter (`POST /api/icp/discovery/promote`), moving approved Exa candidates into `companies` / `segment_members` with ICP tags.
- Web ICP discovery UI now includes a “Promote approved candidates” flow on `IcpDiscoveryPage`, calling the new promotion API and showing a small promotion summary; associated tests cover API usage and success messaging.
- Enrichment provider registry (`createEnrichmentProviderRegistry`) supporting `mock`, `exa`, `parallel`, `firecrawl`, and `anysite` adapters, plus a `--provider` flag on `enrich:run` so enrichment sources can be selected via configuration without changing job semantics.

## [0.1.62] - 2025-12-05
### Added
- Exa enrichment research client (`buildExaResearchClientFromEnv`) and Supabase-bound Exa enrichment adapter wired into the async job-backed `enrich:run --adapter exa` flow for companies and employees.
- Enrichment registry updates and tests so `getEnrichmentAdapter('exa', supabase)` returns the Exa adapter, plus guards that keep Exa on the async path (legacy sync disabled).
- Shape-only HTTP clients for Parallel.ai, Firecrawl.dev, and Anysite.io with env validation helpers and tests, ready to be routed via the enrichment registry in a later phase.
- Database reference and session log updates documenting how Exa enrichment populates `companies.company_research` and `employees.ai_research_data`, with Phase 1 marked complete.

## [0.1.61] - 2025-12-05
### Added
- Parallel.ai and Firecrawl.dev provider env helpers (`loadParallelEnv`, `loadFirecrawlEnv`) plus tests, with README and setup guide updates summarizing required keys and default base URLs.
- Documentation updates clarifying research/enrichment integration: Exa is the primary discovery engine via a small HTTP client, AnySite is used as a targeted enrichment provider (LinkedIn/social/web parsing) via a narrow HTTP interface, and MCP servers for Exa/AnySite are optional façades for external agents.
- Repository guidelines in `AGENTS.md` now explicitly recommend adding short, focused code comments on genuinely tricky parts (invariants, edge cases, non-obvious integrations) while keeping routine code self-explanatory.

## [0.1.60] - 2025-12-05
### Added
- Prompt registry now supports an “active per step” prompt via new web adapter endpoints (`GET /api/prompt-registry?step=…`, `GET /api/prompt-registry/active`, `POST /api/prompt-registry/active`) with dispatch and client tests.
- Web API client and `PromptRegistryPage` now filter entries by step, display an “Active” badge, and expose a “Set active” button that persists the active prompt through the new endpoints.
- Draft generation threads resolved `coach_prompt_id` from the prompt registry into `drafts.metadata.draft_pattern`, so analytics can attribute patterns to the configured coach prompt instead of only the LLM default.

## [0.1.59] - 2025-12-04
### Added
- Web ICP discovery UI now surfaces coach results and job ids next to the “Generate via coach” actions, auto-selects newly created profiles/hypotheses, and reuses existing error alerts for coach failures.
- New CLI commands `icp:coach:profile` and `icp:coach:hypothesis` wrap the coach orchestrator and emit JSON-only `{ jobId, profileId }` / `{ jobId, hypothesisId }` payloads for scripting.
- Coach HTTP responses are standardized to `{ jobId, profile }` / `{ jobId, hypothesis }`, with `web/src/apiClient.ts` returning typed coach results for the UI.

## [0.1.58] - 2025-12-03
### Added
- Generic chat client abstraction `src/services/chatClient.ts` and refactored `AiClient` to delegate to it, with updated tests for draft generation and coach services.
- ICP coach LLM helpers in `src/services/icpCoach.ts` plus orchestration functions `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` in `src/services/coach.ts`, including `jobs` support for a new `icp` job type via migration `supabase/migrations/20251203190000_extend_jobs_type_icp.sql`.
- Web adapter and CLI wiring updated to construct `AiClient` from chat clients and to expose `/api/coach/icp` / `/api/coach/hypothesis` through the new coach orchestration layer; session plan `docs/sessions/2025-12-03_1_icp-coach-express-plan.md` documents the express ICP flow and prompt location.

## [0.1.57] - 2025-12-02
### Added
- `docs/options/2025-12-02_icp_and_oss_reuse_options.md` capturing OSS reuse options for ICP creation and discovery (SalesGPT coach, AI Sales Assistant Chatbot RAG, Exa/AnySite pipelines, and data-driven ICP suggestions).

## [0.1.56] - 2025-12-02
### Changed
- Web README now calls out Smartlead API as the primary integration path; MCP connector exists but lacks a
  verified secure provider, so API envs should be used for live runs.
- `.env.example` now highlights Smartlead API vars (`SMARTLEAD_API_BASE`/`SMARTLEAD_API_KEY`) and leaves MCP
  entries as optional/fallback.

## [0.1.55] - 2025-12-02
### Changed
- Web README now has step-by-step instructions to start the adapter (live vs mock) and Vite dev server,
  including ports and env hints.

## [0.1.54] - 2025-12-02
### Changed
