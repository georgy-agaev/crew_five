# Changelog

All notable changes to this project will be documented in this file.

## [0.1.53] - 2025-12-01
### Added
- `docs/web_ui_requirements.md` as the authoritative Web UI specification (tab order, workflows, analytics, SIM) with cross-references to existing workflow docs and priority note.
- Prompt templates for ICP profile generation and hypothesis+segment filter generation to guide UI coach surfaces.
- Session log updated (`docs/sessions/2025-12-01_2_web-ui-w0v3-w1v2-anv2-plan.md`) to reflect the new UI requirements doc and ICP draft-generation guardrails.
- Web adapter now exposes coach ICP/HYP generation and prompt registry create routes; Web UI pulls prompt registry into draft generation and adds coach generate buttons on the ICP tab; apiClient and tests updated.

## [0.1.52] - 2025-12-01
### Added
- Segment version guardrails: draft and enrichment commands now require a snapshot for the exact `campaign.segment_version` and reject mismatches unless `--force-version` is provided.
- Email event analytics FKs are auto-populated from outbound/draft/campaign context during ingest; idempotency hashing is stable even without `provider_event_id`.
- Analytics view updated to prefer event-level FKs (segment, ICP, pattern, coach prompt) with a new migration.
- ICP list commands whitelist allowed columns and reject unknown selections.

## [0.1.51] - 2025-12-01
### Added
- Async-first enrichment CLI path with `--run-now` and `--legacy-sync` flags plus resolved mode in output; enrichment and draft runs now enforce finalized snapshots via `ensureFinalSegmentSnapshot`.
- ICP-aware draft generation flags (`--icp-profile-id`, `--icp-hypothesis-id`) routed through coach helpers; draft metadata now records ICP IDs for analytics.
- Analytics formatter `formatAnalyticsOutput` to keep `analytics:summary` JSON stable across groupings; additional pattern-group CLI test coverage.
- Email events FK migration `supabase/migrations/20251201120000_add_email_event_fk_columns.sql` adding segment/draft/job/ICP fields for analytics joins; `mapProviderEvent` now emits these keys.
- New list commands `icp:list` and `icp:hypothesis:list` with column filtering and CLI wiring.
- README updated with new CLI flags/commands; full `pnpm vitest run` (185 tests) passing.

## [0.1.50] - 2025-12-01
### Changed
- Workflow and roadmap docs updated to reflect W0.v3, W1.v2, and AN.v2 as implemented and SIM (W2) as contracts-only (Option 2):
  - `docs/workflow_2_sim_replies_prd.md` explicitly notes SIM jobs/requests are defined but not executed yet.
  - `docs/GMT_system_plan_v0.4_roadmap.md` and `docs/gtm_system_workflows_versions_v_0.md` annotate the implementation status of W0.v3, W1.v2, AN.v2, and W2.
- Session log `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` updated to mark Session 8 (hardening and W2 Option 2 sanity) as completed; test suite remains green.

## [0.1.49] - 2025-12-01
### Added
- Prompt registry migration `supabase/migrations/20251201102000_add_prompt_registry.sql` and service `src/services/promptRegistry.ts` to record prompt versions (`coach_prompt_id`, description, version, rollout_status`) for later analysis.
- AN.v2 helpers in `src/services/analytics.ts` (`getPromptPatternPerformance`, `getSimJobSummaryForAnalytics`, `suggestPromptPatternAdjustments`) plus tests in `tests/experiments.test.ts` to aggregate pattern performance, summarize SIM job statuses, and generate simple scale/keep/retire recommendations.
- New CLI command `analytics:optimize` in `src/cli.ts` that prints `{ suggestions, simSummary }` based on analytics; Session 7 in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` marked as completed.

## [0.1.48] - 2025-12-01
### Added
- Analytics view `analytics_events_flat` via `supabase/migrations/20251201043000_add_analytics_events_flat_view.sql` joining events, outbound, drafts, campaigns, segments, and employees to expose ICP, segment, pattern, role, and event fields for reporting.
- Analytics service `src/services/analytics.ts` with helpers to compute baseline metrics (delivered/opened/replied/positive replies) grouped by ICP+hypothesis, segment+role, and pattern+user_edited, plus unit tests in `tests/analytics.test.ts`.
- New CLI command `analytics:summary` in `src/cli.ts` that supports `--group-by icp|segment|pattern` and optional `--since`, printing a JSON summary; Session 6 in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` marked as completed.

## [0.1.47] - 2025-12-01
### Added
- Research storage columns `company_research` and `ai_research_data` via `supabase/migrations/20251201040000_add_research_columns.sql` to hold enrichment output for companies and employees.
- Segment-level enrichment service `src/services/enrichSegment.ts` with helpers to enqueue enrich jobs (`enqueueSegmentEnrichment`), run a single job (`runSegmentEnrichmentOnce`), and inspect status (`getSegmentEnrichmentStatus`), plus tests in `tests/enrichment.test.ts`.
- `enrich:run` command in `src/commands/enrich.ts` now writes mock enrichment results into `employees.ai_research_data` while preserving the existing CLI behaviour; Session 5 in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` updated as completed, test suite remains green.

## [0.1.46] - 2025-12-01
### Added
- Coach service `src/services/coach.ts` introducing helpers to generate ICP profiles from briefs, create hypotheses for segments, and delegate draft generation to the existing `generateDrafts` implementation.
- New unit tests in `tests/coach.test.ts` covering ICP profile and hypothesis creation via the coach layer and verifying that coach-driven draft generation still produces correct `draft_pattern` and `user_edited` metadata.
- Session 4 in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` updated to reflect the coach split helpers as completed, while leaving `draft:generate` behaviour unchanged for now.

## [0.1.45] - 2025-12-01
### Added
- ICP schema migration `supabase/migrations/20251130220000_add_icp_profiles_and_hypotheses.sql` creating `icp_profiles`/`icp_hypotheses` tables and adding `icp_profile_id`/`icp_hypothesis_id` FKs on `segments`.
- ICP service `src/services/icp.ts` with helpers to create profiles and hypotheses and attach them to segments, plus coverage in `tests/icp.test.ts`.
- New CLI commands `icp:create` and `icp:hypothesis:create` wired in `src/cli.ts` via `src/commands/icpCreate.ts` and `src/commands/icpHypothesisCreate.ts`, with CLI tests in `tests/cli.test.ts`; Session 3 in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` marked as completed.

## [0.1.44] - 2025-11-30
### Added
- Generic `jobs` table via `supabase/migrations/20251130205000_add_jobs_table.sql` to track `send`, `enrich`, and `sim` jobs with shared lifecycle fields.
- Jobs service (`src/services/jobs.ts`) with helpers to create and update jobs, plus unit tests in `tests/jobs.test.ts`.
- SIM Option 2 stub service (`src/services/sim.ts`) that accepts structured SIM requests, records them as `sim` jobs, and marks them as `not_implemented` with clear reasons for future W2 work. Session roadmap doc `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` updated to mark Session 1 as completed; lint, build, and full test suite remain green.

## [0.1.43] - 2025-11-30
### Added
- `public-docs/` folder with public-facing getting started, architecture, and extensibility guides to support the open-core OSS audience.
- README refocused on the open-core toolkit (CLI + Web + Supabase) and wired to the new `public-docs` entry points instead of internal-only docs.
- Open-core code boundaries documented in `AGENTS.md` so future CRM/connectors can live outside the public repo while reusing core interfaces.

## [0.1.42] - 2025-11-30
### Changed
- Updated `.gitignore` and git tracking so `docs/` and `AGENTS.md` are kept local-only and no longer pushed to the public GitHub repo; future changes to internal docs stay off the public history.

## [0.1.41] - 2025-11-28
### Added
- Security sweep workflow running ESLint security config, ast-grep guardrails, gitleaks secret scan, and `pnpm audit --prod --audit-level high` with install safety (`--ignore-scripts`).
- ESLint security-focused config and scripts for linting, ast-grep scans, secret scans, and audits; README documents the new commands.
- ast-grep setup doc now reflects the current guardrails enforced in `ast-grep.yml`.

## [0.1.40] - 2025-11-27
### Added
- Smartlead direct API wiring for campaigns/leads/sequences: new helpers in `src/integrations/smartleadMcp.ts` plus CLI commands `smartlead:leads:push` and `smartlead:sequences:sync` with dry-run and Supabase-backed mapping.
- Draft generation now records a stable `draft_pattern` (prompt pack + Pattern Breaker mode + variant) and `user_edited` flag in `drafts.metadata` for later analysis of AI-only vs user-edited emails.
- Requirements ID scheme documented in `docs/Requirements_ID_Scheme.md` and referenced from PRD v0.2 and the v0.3/v0.4 roadmaps to tie features to explicit IDs.

## [0.1.39] - 2025-11-27
### Added
- Web adapter routes for Workflow 0: companies/contacts fetch with caps and Smartlead send defaulting to dry-run; mock/live deps updated.
- Workflow 0 UI now pulls live Supabase companies/contacts, applies cohort caps, auto-excludes missing emails, and triggers Smartlead preview send.
- API client helpers for companies/contacts and Smartlead preview; tests cover URL construction and payload defaults.

## [0.1.38] - 2025-11-27
### Added
- Workflow Hub web UI covering PRD v0.2 flows: client selection → base email → bump setup, ICP discovery/Exa query planning, and SIM/offer roast planner with readiness cues.
- New helper pages (`WorkflowZeroPage`, `IcpDiscoveryPage`, `SimPage`) with mock data, guardrails, and Smartlead/Supabase readiness badges; updated layout, typography, and cards/tabs for clearer navigation.
- Tests for new workflow helpers (filters, ICP query derivation, SIM scoring); README updated with Web UI workflow guidance.

## [0.1.37] - 2025-11-27
### Added
- Direct Smartlead API client (`addLeadsToCampaign`, `saveCampaignSequences`) gated by `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY`, retaining MCP compatibility and stubbing sendEmail for adapter parity.
- New CLI commands `smartlead:leads:push` and `smartlead:sequences:sync` wired through `src/cli.ts` with dry-run, limit/step/variant flags, and Supabase contact-to-lead mapping.
- Web adapter readiness meta now respects Smartlead API envs; server tests cover missing Smartlead env validation.
- Documentation updates (`README.md`, `docs/Setup_smartlead_mcp.md`) describing Smartlead direct API setup and new commands; CLI and integration tests added for Smartlead flows.

## [0.1.36] - 2025-11-26
### Added
- Shared CLI error-handling helper (`wrapCliAction`/`formatCliError`) for `draft:generate`, `segment:snapshot`, `event:ingest`, and Smartlead commands to surface clean messages and stable exit codes instead of unhandled promise rejections.
- `campaign:create --dry-run` flag wired through `campaignCreateHandler`, which now runs snapshot workflow without inserting a campaign and returns a summary payload.
- `draft:generate --limit` flag exposed at the CLI and threaded into `generateDrafts` to cap work per run; handler and CLI wiring covered by tests.
### Added
- Optional JSON error output via `--error-format json` on `campaign:status`, `event:ingest`, and `smartlead:events:pull` so automation can consume structured `{ ok:false, error:{ code,message,details } }` payloads.
### Changed
- Smartlead CLI tests updated to assert validation behaviour for bad `--since`/`--limit` and missing MCP env; CLI now logs concise errors rather than throwing.

## [0.1.35] - 2025-11-25
### Added
- Sub-agent roster with commands/boundaries in `AGENTS.md` aligned to docs/CLI/prompt/DB/UI/test/ops roles.
- Individual Copilot agent personas in `.github/agents/*.md` for docs, cli, prompt, db, test, ui, and ops.

## [0.1.33] - 2025-11-25
### Added
- Live web adapter wiring option with Supabase-backed deps and stub AI/Smartlead, env-switchable mock mode.
- App base URL notice and adapter config docs; adapter dispatch tests cover live deps.

## [0.1.34] - 2025-11-25
### Added
- Live adapter env validation for Smartlead MCP; buildSmartlead client helper.
- Events/reply-pattern dispatch tests for filters; UI badge shows adapter mode.
- Docs updated with Smartlead env requirements for web adapter.
### Changed
- Draft generate payload now carries interaction/data-quality mode flags through adapter.
- Added adapter meta endpoint and readiness cues in UI; send disabled when Smartlead not ready.

## [0.1.32] - 2025-11-25
### Added
- Web UI parity pass: shared alert component, drafts table with status filter, mode toggles (Strict + Pipeline
  Express defaults), send gating confirmation, and helper tests.
- Thin HTTP adapter with mock deps (`src/web/server.ts`) plus dispatch tests; web README documents adapter
  endpoints and dev flow.
### Changed
- Hardened web API client tests (env base URL/error) and removed legacy mock client/test.

## [0.1.24] - 2025-11-24
### Added
- Smartlead outbound send command (`smartlead:send`) with dry-run, batch size, and summary logging,
  plus MCP send wrapper and outbound recording.

## [0.1.25] - 2025-11-24
### Added
- Reply classification and pattern counting: `reply_label` mapping, pattern helper, and tests.

## [0.1.26] - 2025-11-24
### Added
- Smartlead MCP docs: noted reply labels/pattern usage for prompt/enrichment feedback and `assume-now` logging guidance.

## [0.1.27] - 2025-11-24
### Added
- Documented telemetry/log guidance for `onAssumeNow` and reply pattern usage to feed prompt/enrichment updates.

## [0.1.28] - 2025-11-25
### Added
- Enrichment stub (adapter registry + mock) with CLI `enrich:run` (dry-run/limit).
- Graceful fallback service (catalog lookup, apply, guard) with tests).
- Judge scaffold for draft scoring + CLI `judge:drafts` (dry-run/limit).
- ast-grep guardrails tightened (errors on key rules); docs updated.

## [0.1.29] - 2025-11-25
### Added
- Tracing service + instrumentation for AI drafts and Smartlead MCP calls (env toggle/cap; traces to console/file).
- Telemetry service and `--telemetry` flag on Smartlead CLI commands (PII validation).
- Prompt experiments helpers (deterministic variant assignment/outcome logging).
- Smartlead send dedupe/batch summary, graceful preview wiring, reply pattern filters; tests updated.

## [0.1.30] - 2025-11-25
### Added
- Web UI prep: mock API client (`src/web/apiClient.ts`) for campaigns/draft generation/send with tests; session plan updated. Full UI scaffold pending.

## [0.1.31] - 2025-11-25
### Added
- Web UI scaffold expanded: Drafts, Send, Events/Patterns, Settings pages wired to mock API; settings/telemetry hooks; styles and navigation.
- Web package tests added for API client, settings store, telemetry hook.

## [0.1.23] - 2025-11-24
### Added
- Smartlead MCP polish: capped error snippets with truncation note, per-pull timestamp for assume-now,
  optional logging hook for assume-now usage, and env override for Retry-After cap.

## [0.1.22] - 2025-11-24
### Added
- Smartlead MCP ingest consistency: single pull timestamp for `--assume-now-occurred-at`, centralized
  Retry-After cap constant, and aligned error hints (code for missing `occurred_at`).

## [0.1.21] - 2025-11-24
### Added
- Smartlead MCP ingest guardrails: Retry-After respected (cap/override), non-mutating error cache, CLI
  flags for retry cap and `--assume-now-occurred-at`, and clearer error guidance.

## [0.1.20] - 2025-11-24
### Added
- Smartlead MCP ingest polish: require `occurred_at` for events, deterministic hash remains; errors cache body/JSON once; 4xx/5xx paths tested for single body read; docs clarify Zulu-only `--since`.

## [0.1.19] - 2025-11-24
### Added
- Smartlead MCP ingest robustness: deterministic idempotency hash when provider_event_id is missing,
  enriched error messages (status + body), simple retry on 5xx, and CLI validation for `since`/`limit`
  with max cap.

## [0.1.18] - 2025-11-24
### Added
- Smartlead MCP ingest hardening: `since`/`limit` filters on event pulls, provider_event_id fallback
  for idempotency, CLI wiring for filters, and single-summary outputs with dry-run parity.
- Docs updated (README, Smartlead setup) and tests expanded for MCP URL params and idempotency.

## [0.1.17] - 2025-11-24
### Added
- Smartlead MCP ingest-first integration: typed client wrapper, CLI commands `smartlead:campaigns:list`
  and `smartlead:events:pull` with `--dry-run` and summaries; events flow through existing
  `event:ingest` path.
- Tests cover MCP client auth/dry-run/normalization and CLI wiring.

## [0.1.16] - 2025-11-23
### Added
- Documented Smartlead MCP setup/integration options (env vars, guardrails, ingest-first path) to
  reuse the MCP server instead of building a custom connector first.
- README now calls out Smartlead MCP as optional and `.env.example` includes MCP placeholders.

## [0.1.15] - 2025-11-23
### Added
- Campaign status CLI rewired to use guarded handler with dry-run; invalid transitions exit non-zero.
- Draft orchestrator adds dry-run/fail-fast/limit with summary; CLI flags documented; tests updated.

## [0.1.14] - 2025-11-23
### Added
- Event ingest stub (`event:ingest`) with validation, dedupe on provider_event_id, and dry-run support; service normalizes payloads and inserts into `email_events`.
- CLI wiring for event ingest; README lists the stub; tests cover validation, dedupe, dry-run.

## [0.1.13] - 2025-11-23
### Added
- Send scaffold now supports batch_id override, logger callback, fail-on-error flag, and keeps dry-run semantics; summary logging is single-source.
- Email send CLI exposes batch-id/fail-on-error flags; tests add dry-run and summary format coverage; docs updated.

## [0.1.12] - 2025-11-23
### Added
- Email send CLI now supports summary formats (json/text), dry-run, and JSON logging; send scaffold returns batch_id/timestamp summary.
- Tests cover throttle/skip and retry logging; docs updated with CLI options.

## [0.1.11] - 2025-11-23
### Added
- Hardened send scaffold with per-minute throttling, duplicate guard (mark drafts sending), retry-once stub, and summary logging (`sent/failed/skipped`).
- CLI send wiring retains stub provider and supports JSON logs; tests cover throttle/skip and retry logging.

## [0.1.10] - 2025-11-23
### Added
- Email send scaffold (`email:send` CLI) with stubbed SMTP send/log/throttle and outbound recording.
- README documents the send scaffold command; tests cover stub send and throttle behavior.

## [0.1.9] - 2025-11-23
### Added
- Centralized status transitions in `src/status.ts` (typed union + helper); errors carry `ERR_STATUS_INVALID` with allowed transitions in details.
- Validation CLI formats refined (json/text/terse) with codes/hints and consistent exit codes; telemetry stub retained.
- Roadmap/session updated to reflect finalized status/validation UX.

## [0.1.8] - 2025-11-23
### Added
- Campaign status typed union plus exported transition map helper; invalid transitions now use `ERR_STATUS_INVALID`.
- `filters:validate` supports `json|text|terse` formats, returns codes/hints, sets exit codes, and includes a telemetry stub.
- README (validate command formats) and appendix link to status/validation sections; session log added.

## [0.1.7] - 2025-11-22
### Added
- Structured filter validation errors with `ERR_FILTER_VALIDATION` code, JSON/text output formats, and CLI wiring that exits non-zero on failure.
- Status transition helper exposed and documented; campaign updates continue to enforce allowed statuses/fields.
- Session docs/roadmap updated to reflect status enforcement/validation UX refinements.

## [0.1.6] - 2025-11-22
### Added
- Campaign status transition map (including pause/resume) with table tests; `campaign:update` still limited to prompt_pack_id/schedule/throttle and blocked outside draft/ready/review.
- `filters:validate` CLI command outputs structured JSON and exits non-zero on errors; filter validation now returns friendly messages with allowed prefixes/operators.
- README updated with status transition table and validate command; session logs/roadmap refreshed.

## [0.1.5] - 2025-11-22
### Added
- Snapshot hashing for reuse/refresh with hash mismatch rejection, filter validation errors improved, and `--force-version` wiring/guardrails in CLI/handlers.
- Campaign update guardrails block non-draft/ready/review statuses; filter DSL tests expanded (`not_in`, range/list), and docs updated (README, appendix).

## [0.1.4] - 2025-11-22
### Added
- Introduced validated segment filter DSL (`eq`, `in`, `not_in`, `gte`, `lte`) in `src/filters/` with guardrails for unknown fields and empty filters.
- Enforced snapshot guardrails (default max 5000 contacts, `--max-contacts`, `--allow-empty`) and tightened snapshot workflow defaults.
- Added `campaign:update` CLI/handler limited to `prompt_pack_id`, `schedule`, `throttle`; updated CLI wiring and docs.

## [0.1.3] - 2025-11-22
### Added
- Added tracked `prompts/template.md` and adjusted ignore rules so prompt drafts stay local while the template remains versioned.

## [0.1.2] - 2025-11-22
### Added
- Created `prompts/` folder for prompt drafts and ignored its contents (tracked placeholder only) to keep credentials and prompt iterations out of git.

## [0.1.1] - 2025-11-22
### Added
- Initialized git repository on `main` and added a repo-appropriate `.gitignore`.

## [0.1.0] - 2025-11-21
### Added
- Initial AI SDR GTM PRD (`docs/AI_SDR_GTM_PRD.md`) covering context, architecture spine, data-quality modes, interaction modes, analytics, release plan, and AI SDK integration.
- Appendix A with the non-negotiable `generate_email_draft` contract (`docs/appendix_ai_contract.md`).
- Pattern Breaker analytics requirements and monthly review strategy.
- CLI/UI parity requirement, interaction mode toggles, strict/graceful data-quality policies, and SMTP-first sending strategy.
- Supabase project linked (`supabase/config.toml`) with first migration `20251121211952_2025-11-21_create_spine_tables.sql` defining spine tables (`segments`, `segment_members`, `campaigns`, `drafts`, `email_outbound`, `email_events`, `fallback_templates`).
- Node/TypeScript CLI scaffold (`src/cli.ts`) with handlers for segment creation, campaign creation, and draft generation plus Vitest coverage for env loading, services, and commands.
- Segment snapshot pipeline added: filter parser, contact fetch, snapshot writer, `segment:snapshot` CLI command, and documentation/tests covering the new flow.
- Campaign creation now enforces snapshots via `ensureSegmentSnapshot` workflow, supports `--snapshot-mode`/`--bump-segment-version`, persists snapshot metadata in campaigns, and schema includes `segments.version` column.

### Changed
- Prioritized SMTP adapter over Smartlead; removed Leadmagic integration references from the PRD.
- Updated release plan milestones to include interaction-mode implementation and graceful-mode unlock post enrichment.

### Notes
- Changelog will be updated alongside future PRD or implementation changes.
