# AI SDR GTM System – Product Requirements Document
_Version 0.1 — 2025-11-21_

> Source inputs: `docs/AI_SDR_Toolkit_Architecture.md`, `docs/GMT_system_plan.md`, `docs/Setup_Guide.md`, `docs/Database_Description.md`. Supabase is the canonical datastore; AI SDK (https://ai-sdk.dev) is the standard LLM integration layer for CLI and backend services.

**Appendices**
- Appendix A – AI Draft Generation Contract (`docs/appendix_ai_contract.md`)

## 1. Context & Scope
- **Problem statement**: Seed-stage founders and lean GTM teams juggle CSV imports, manual research, and siloed sending tools. There is no cohesive loop from company/contact intake to AI-personalized outreach and feedback. Draft quality varies, deliverability is hard to govern, and orchestration requires multiple dashboards.
- **Vision**: Deliver a single-channel GTM system anchored on Supabase that orchestrates data intake → segmentation → prompt-pack-powered drafts → approvals → sending via SMTP adapter first (Smartlead optional) → reply logging. The system uses AI SDK to standardize all LLM traffic, ensuring routing, observability, and guardrails. It is intentionally not a CRM, billing platform, or multi-channel sequencer.
- **In-scope v1**: CLI-based CSV ingestion, Supabase-backed segments/campaigns/drafts, minimal web UI (segment selector, draft review, outreach control, logs), AI SDK + prompt packs for draft generation, Smartlead/SendEmail integration, IMAP reply ingest, light admin for prompt packs/providers, CLI parity for ops tasks.
- **Out-of-scope**: CRM sync, multi-channel cadences, automated billing, compliance automation beyond unsubscribes, heavy enrichment (beyond Stage 2), complex analytics warehouse, multi-tenant UI policies (single tenant only for now).

## 2. Objectives & Success Metrics
- **Business goals**: Launch first campaign <2h after workspace setup; increase qualified replies 30% over manual baseline; support ≥5 concurrent campaigns/operator without extra tooling.
- **Product metrics**: ≥70% of imported contacts land in saved segments; ≥60% drafts approved without edits; reply rate ≥5%; throughput ≥500 sends/day/workspace; AI SDK-mediated draft latency <45s per 50-contact batch.
- **Guardrails**: Bounce rate <2%; AI quality score ≥0.8; `employees.reply_*` fields accurate for suppression; provider latency <5s per send; prompt pack + AI SDK guardrails enforce tone/localization.
- **Markets/languages**: Russian primary, English secondary, optional ES/FR via prompt packs. Single-tenant Supabase deployments.

## 3. Users & Personas
- **GTM Engineer / Ops**: CLI-heavy (`company:*`, `prompt:*`, `workflow:*`, `email:*`), owns data intake, segmentation automation, campaign runs, and relies on deterministic commands, YAML config, and CI-friendly logging.
- **Founder / Sales Lead**: Web UI user needing quick segment visibility, draft approvals, provider configuration, and campaign monitoring without CLI context switching.
- **SDR / AM (future)**: Light UI flows for reviewing assigned drafts and triaging replies.
- **Jobs to be done**: Ingest/normalize contacts, construct segments, produce localized drafts leveraging AI SDK routing, approve edits quickly, send through unified provider layer, process replies, iterate on prompt packs. Constraints: lean headcount, compliance basics only, single-tenant Supabase, minimal workflow friction.

## 4. Core Use Cases & User Flows
For each flow: actor → trigger → steps → system behavior → success criteria.
1. **Company & contact intake** (GTM Engineer) → CLI `gtm ingest csv` → validate schema (`companies`, `employees`), dedupe on `tin`/`registration_number`/`work_email`, persist with `session_key`/`batch_id`, emit summary logs → all valid rows stored, errors exported.
2. **Segment building & saving** (GTM Engineer/Founder) → apply filters (industry, region, role, reply flags), preview counts, save definition JSON → Supabase stores `segments` + snapshot membership (versioned) → segment accessible via UI & CLI.
3. **Campaign setup** (Founder) → select segment, sender profile, prompt pack version, schedule/throttles, interaction mode (Interactive Coach vs Pipeline Express), and desired data-quality mode → validation (non-empty segment, provider capacity, `do_not_contact`), create `campaigns` row with mode flags → status `ready_for_generation`.
4. **Draft generation** (System via orchestrator) → trigger `campaign.generate` job → batch contacts, fetch `company_research`/`ai_research_data`, invoke AI SDK with prompt pack metadata (DSPy/GEPA wrappers), store `drafts` + `ai_interactions` + AI SDK request IDs → 100% contacts receive drafts or flagged errors.
5. **Draft review & editing** (Founder) → open review queue, inspect AI score & variant labels, edit individually or bulk approve, request regen → system stores version history, updates statuses → target approval ratio hit.
6. **Sending & scheduling** (System) → scheduler pulls approved drafts respecting throttles, dispatch via Smartlead or SMTP adapter, log `email_outbound`, update `employees` statuses → sending completes without rate-limit failures.
7. **Feedback loop** (System) → IMAP/webhook detects replies/bounces, classify outcome, update `employees.reply_*`, create `email_inbound` entries, optionally re-open contact in UI → accurate engagement metrics and suppression.
8. **Admin/config flows** (GTM Engineer) → manage prompt packs, provider API keys, AI SDK provider configs, CLI tokens → audit trail maintained.

All flows above culminate in the canonical spine `segment → segment_members → campaign → drafts → email_outbound → email_events`. Plugins (Pattern Breaker variants, multilingual prompts, analytics) hook onto the relevant spine node but never create alternative paths.

## 5. Product Scope & Feature Breakdown
- **Segmentation engine**: UI filter builder + CLI query, saved segments, snapshots, previews, exports. Powered by Supabase indexes and `session_key`/`batch_id` metadata.
- **Campaigns & drafts**: Campaign lifecycle, batch generation, AI SDK-based variant management, approval tooling, regen, metrics.
- **Campaigns & drafts**: Campaign lifecycle, batch generation, AI SDK-based variant management, approval tooling, regen, metrics. Default modes for new campaigns are **Strict** data quality + **Pipeline Express** interaction; switching to Interactive Coach or Graceful mode is allowed prior to draft generation and logged.
- **Web UI**: Stage 1 screens (segment selector, draft preview, outreach control, logs) plus settings; Stage 2 adds insights panels; Stage 3 adds trace explorer.
- **Web UI**: Stage 1 screens (segment selector, draft preview, outreach control, logs) plus settings; all capabilities must mirror CLI functionality one-to-one (segment management, campaign creation, mode toggles, resend/retry controls). Stage 2 adds insights panels; Stage 3 adds trace explorer.
- **CLI toolkit**: Node/TS CLI per Architecture doc, config loader, caching (SQLite/Redis), commands for ingest, segments, campaigns, prompt packs, benchmarking; uses AI SDK for local testing when orchestrator unavailable.
- **CLI toolkit**: Node/TS CLI per Architecture doc, config loader, caching (SQLite/Redis), commands for ingest, segments, campaigns, prompt packs, benchmarking; supports Interactive Coach sessions (multi-turn question flow) and Pipeline Express runs (single-call contract invocation) via explicit flags (e.g., `--interaction={coach|express}`, `--quality={strict|graceful}`). CLI and Web UI must remain capability-parity: every action (segment save, campaign launch, approval, reschedule, mode toggle) is achievable from both surfaces. Uses AI SDK for local testing when orchestrator unavailable.
- **Integrations**: EXA/Parallels/Anysite research (Stage 2), SMTP sending (priority) with optional Smartlead connector, IMAP inbound, Inspect benchmarking harness, observability exporters (pino + OpenTelemetry/LangSmith). AI SDK unifies LLM providers.
- **Plugin philosophy**: Pattern Breaker variants, multilingual prompt packs, enrichment, analytics, and benchmarking are optional plugins that attach to the spine at clearly defined points (e.g., drafts, email_outbound, email_events) without creating alternate flows. Each plugin must document which spine component it extends and how it writes/reads data.

## 6. Data Model & Database Requirements
- **Existing tables**: `companies`, `employees`, `ai_interactions` per Database doc; maintain indexes on `tin`, `registration_number`, `work_email`, `company_id`, session keys.
- **New tables**: `segments`, `segment_members`, `campaigns`, `drafts`, `sender_profiles`, `prompt_packs`, `email_outbound`, `email_events` (normalized opens/clicks/replies/bounces with outcome classification), `email_inbound`, `provider_accounts`, `fallback_templates` (predefined content for graceful mode), Stage 2 `company_insights`/`employee_insights`, Stage 3 `api_traces`, `benchmark_results`.
- **Key fields**: `segments.filter_definition`, `segments.version`, `campaigns.status/throttle_json`, `drafts.ai_score/variant_label/ai_sdk_request_id`, `email_outbound.provider/message_id`, `ai_interactions.latency/model/prompt_hash`, `insights.payload`, `api_traces.correlation_id`.
- **Key fields**: `segments.filter_definition`, `segments.version`, `campaigns.status/throttle_json/data_quality_mode/interaction_mode`, `drafts.ai_score/variant_label/ai_sdk_request_id`, `email_outbound.provider/message_id/pattern_persona`, `email_events.event_type/provider_ref/outcome_classification`, `fallback_templates.category/locale/payload`, `ai_interactions.latency/model/prompt_hash`, `insights.payload`, `api_traces.correlation_id`.
- **Indexing/perf**: workspace-aware indexes, `drafts(campaign_id,status)`, `email_outbound(campaign_id)`, GIN on JSON definitions, partial indexes for `employees.processing_status='pending'`.
- **RLS/security**: single tenant default; tag all rows with `workspace_id` for future multi-tenant, restrict admin tables via service role.

## 6.1 System Spine (Canonical Contract)
- **Principle**: Every GTM workflow—CLI, UI, automations, or plugins—must traverse the same linear spine: `segment → segment_membership snapshot → campaign → drafts → email_outbound → email_events`. Anything outside this spine (Pattern Breaker modes, multilingual packs, analytics, enrichment) is a plug-in layer that decorates or augments one of these nodes without altering the contract.
- **Core tables**:
  - `segments`: saved filter definition and metadata.
  - `segment_members`: immutable snapshot of contacts linked to a segment version; provides referential stability for campaigns.
  - `campaigns`: binding of segment snapshot + sender profile + prompt pack + schedule.
  - `drafts`: AI outputs awaiting approval and send; include variant metadata and AI SDK trace IDs.
  - `email_outbound`: canonical record of every send with provider + pattern data.
  - `email_events`: replies, bounces, opens, clicks, categorized outcomes (meeting / soft interest / decline / angry) feeding analytics.
- **Core services**:
  - **Draft generator**: orchestrator using AI SDK + DSPy/GEPA to produce drafts and write into `drafts` (+ `ai_interactions`).
  - **Sender adapter**: SMTP adapter is the default path; Smartlead integration is optional. Both ensure all sends originate from approved drafts and log to `email_outbound`.
  - **Event ingester**: IMAP/webhook workers that translate provider events into normalized `email_events` rows (with Pattern Breaker metadata and persona clusters).
- **Implication**: CLI commands, AI SDK middleware, Supabase triggers, and third-party integrations all play supporting roles but may not bypass the spine. Any new feature must specify which spine step it hooks into (e.g., Pattern Breaker tags enrich `drafts`, multilingual packs change draft generator behavior, analytics reads from `email_events`). This keeps the system composable and guarantees observability end-to-end.

## 7. System Architecture & Components
- **High-level**: CLI + Web UI ↔ Supabase (DB/Auth/Storage) ↔ Orchestrator service ↔ AI SDK (multi-provider LLMs) ↔ External research APIs + sending providers ↔ IMAP feedback loop.
- **Components**: Node/TS CLI, Next.js web app, Supabase (DB/Auth/Storage), orchestrator workers (Node with DSPy/GEPA Python sidecar), queue/cron (Supabase functions or external worker), AI SDK client module, research adapters, provider adapters, logging pipeline.
- **Communication patterns**: Web app via Supabase client + backend RPC; orchestrator subscribes to queue for generation/sending; AI SDK handles outbound LLM requests with middleware capturing logs; cron jobs for IMAP sync + segment rebuilds; CLI uses REST/tRPC endpoints.
- **Code agents**: Claude Code/Codex CLI assist migrations, scaffolding, tests, especially for Supabase schema updates and AI SDK integration scaffolds.

## 8. LLM & AI-Specific Requirements
- **Prompt packs**: Markdown specs (e.g.,`Cold_Introduction_Email_Coach_v3_0_Enchanced.md`, `Cold_Bump_Email_Coach_v2_Enhanced.md`) parsed into structured schema (metadata, languages, pattern breakers, quality checklist). Stored with versioning, ownership, and changelog. Support cold intro, bump, follow-up, and research coach variants.
- **AI SDK policy**: AI SDK centralizes provider routing—default Claude 3.5 for empathetic drafts, GPT-4o fallback, optional cost-effective models for experiments. Routing rules stored in config and enforced by AI SDK middleware (retries, timeout, circuit breakers).
- **Quality & evaluation**: Integrate LLM-as-a-Judge (Stage 2) through AI SDK so evaluation prompts reuse the same logging. Maintain benchmark datasets accessible via CLI `benchmark:run`, persist results in Supabase, run regression suites when prompt packs update.
- **Safety & compliance**: GEPA guardrails layered atop AI SDK outputs; enforce tone rules, localization, forbidden patterns, unsubscribe language. AI SDK middleware masks PII in logs and attaches correlation IDs for traceability.
- **AI contract (non-negotiable interface)**: every system component calls a single typed function `generate_email_draft(email_type, language, pattern_mode, brief)`. See Appendix A for the exact TypeScript interfaces. CLI, UI, Supabase stored procedures, and AI SDK-backed providers must all honor this shape; any prompt/model change is hidden behind this contract to keep the spine stable.
- **Interaction modes**: prompt packs must expose both **Interactive Coach Mode** (multi-turn, question-asking flows for humans in CLI/UI) and **Pipeline Express Mode** (single-shot calls for automation/GTM engines). Express mode uses a dedicated system prompt (“You are the Cold/Bump Email Coach in PIPELINE EXPRESS MODE… Do not ask questions… Output JSON {subject, body} respecting language/pattern/constraints.”) and consumes the Appendix A brief verbatim; the coach performs internal reasoning but returns only the final JSON. Interactive flows capture clarifications, cache them in Supabase, then call the same contract. All prompt updates must maintain parity across both modes.

## 9. Functional Requirements by Module
- **Segments**: create/edit/delete via UI & CLI, preview counts, snapshot membership, max 1M contacts, filter validation, export contacts, apply `do_not_contact` gating.
- **Campaigns**: state machine (Draft → Ready → Generating → Review → Scheduled → Sending → Complete); validation of provider capacity, ability to pause/resume, metrics dashboard.
- **Drafts**: AI SDK-based generation with multi-variant storage, manual edit history, bulk approvals, regen per contact, concurrency-safe locking, offline editing (CLI) for GTM engineers.
- **Sending**: provider abstraction (Smartlead/SMTP), throttling per profile/day, retries/backoff, fallback provider options, deliverability monitoring, logging to `email_outbound`.
- **Reporting**: campaign dashboards, `campaign:status` CLI command, download CSV of sends/replies, AI SDK latency/quality charts.
- **CLI**: config validation, dry-run support, caching for research, AI SDK integration for local prompt tests, Inspect benchmarking commands.
- **Modes & toggles**: storing `interaction_mode` and `data_quality_mode` on `campaigns`; defaults Strict + Pipeline Express, mutable until drafts are generated. CLI commands expose `--interaction={coach|express}` and `--quality={strict|graceful}`, while the UI presents equivalent toggles and surfaces warnings before switching away from defaults.
- **CLI**: config validation, dry-run support, caching for research, AI SDK integration for local prompt tests, Inspect benchmarking commands.
- **Edge cases**: CSV mismatch yields error file, duplicate contacts resolved by unique constraints, provider outage triggers automatic campaign pause, AI SDK failure surfaces to review queue with clear diagnostics.
- **Data quality modes**: support **Strict mode** (default early on) that blocks campaign/draft generation if critical fields (company_name, role, product one-liner, required research attributes) are missing—CLI and UI surface actionable errors so ingestion/research pipelines must correct the dataset. Provide opt-in **Graceful mode** once confidence is higher; it enforces explicit fallbacks (e.g., omit trigger mention when `recent_events` empty, inject predefined category pain when `pain_point` missing) while still forbidding fabricated facts (no invented funding rounds, hires, etc.). Modes are configured per workspace/campaign and logged with outcomes.
- **Data quality modes**: support **Strict mode** (default early on) that blocks campaign/draft generation if critical fields (company_name, role, product one-liner, required research attributes) are missing—CLI and UI surface actionable errors so ingestion/research pipelines must correct the dataset. Provide opt-in **Graceful mode** only after enrichment adapters (EXA/Parallels/Anysite) are connected; it enforces explicit fallbacks (e.g., omit trigger mention when `recent_events` empty, inject predefined category pain when `pain_point` missing) while still forbidding fabricated facts (no invented funding rounds, hires, etc.). Modes are configured per workspace/campaign and logged with outcomes.
- **Interaction defaults**: automated sending paths (Pipeline Express) always assume Strict mode unless explicitly overridden. Interactive Coach sessions may opt into Graceful mode for experimentation (only after enrichment APIs are available) but must persist the mode choice when the campaign is finalized.

## 10. Non-Functional Requirements
- **Performance**: CSV validation of 10k rows <2 min; segment queries <3s for 100k contacts; AI SDK generation batches (50 contacts) <45s; UI interactions <500ms for key actions.
- **Reliability**: AI SDK retries (3 attempts) with exponential backoff and provider fallback; durable queues for generation/sending; circuit breakers on provider outages; IMAP watcher heartbeat; correlation IDs across Supabase + AI SDK logs.
- **Security & compliance**: Supabase Auth roles, secrets via `.env`/1Password CLI per Setup Guide, encrypted storage, CAN-SPAM compliance (unsubscribe, accurate sender, `do_not_contact`).
- **Observability**: Structured logs (pino), metrics (latency, approval %, bounce, AI SDK cost), traces captured via AI SDK middleware feeding `api_traces`, OTEL/LangSmith exporters optional.

## 11. Release Plan & Stages
- **Stage 0.5 – Foundations**: confirm Supabase contract, add `outreach_status`/`last_outreach_at`, create `email_outbound`, define CSV formats, stand up AI SDK module in CLI for testing.
- **Stage 0.5 – Foundations**: confirm Supabase contract, add `outreach_status`/`last_outreach_at`, create `email_outbound`, define CSV formats, stand up AI SDK module in CLI for testing, and seed `fallback_templates` for graceful mode.
- **Stage 1 – Outreach MVP**: deliver segmentation, campaigns, drafts, AI SDK-powered generation, SMTP adapter (first-class) with optional Smartlead connector deferred, minimal UI screens, IMAP replies, CLI parity, and ship the first version of Interaction Mode toggles (Interactive Coach vs Pipeline Express) wired through both CLI and UI with default Strict+Express. Acceptance: 100–300 contacts/day, bounce <2%.
- **Stage 2 – Enrichment & Judge**: integrate EXA/Parallels/Anysite, add insights tables, AI SDK-driven LLM-as-a-Judge scoring, multilingual prompt behavior, and unlock Graceful mode toggles now that enrichment confidence exists. Acceptance: 15% personalization score uplift, RU drafts ready.
- **Stage 3 – Trace Logging & Optimization**: populate `ai_interactions` + `api_traces`, build trace explorer UI, advanced analytics, prompt/routing experiments, and iterate on Interaction Mode telemetry (record usage, errors, toggles) to inform future automation. Acceptance: ≥95% AI interactions traced, ability to compare prompt variants, documented interaction-mode metrics.

## 12. Risks, Assumptions & Open Questions
- **Risks**: Provider cost/latency, deliverability, scope creep, compliance variations, AI SDK feature maturity for certain providers, data privacy of imported contacts.
- **Assumptions**: Single-tenant Supabase, SMTP first provider (Smartlead fallback), lists ≤50k contacts, operators comfortable with CLI, AI SDK supports required providers, compliance limited to unsubscribe basics.
- **Open questions**: Which provider prioritized if Smartlead unavailable? Timeline for ES/FR localization? CRM integration expectations? Compliance strictness per geography? Required AI SDK features (tool calling, eval) for Stage 2/3 and whether custom workarounds needed.

## 13. Analytics & Reporting
- **Dashboards**: campaign metrics (sends, opens, replies, bounce), segment engagement, draft approval %, AI SDK performance (latency, cost, fallback usage), and Pattern Breaker efficacy charts.
- **Pattern Breaker analytics**: log per-send metadata `{pattern_variant, persona_cluster, reply_flag, outcome (meeting / soft_interest / decline / angry)}` in `email_outbound` or dedicated fact table. Monthly job computes: Reply %, Meeting %, Angry % per pattern overall, plus split views for Conservative vs Bold and Relationship vs Skeptical/Busy personas. Automatically flag patterns for retirement if `Meeting% ≈ Standard` but `Angry% > 2× Standard`, and boost ones with meaningfully higher Meeting% without materially higher Angry%. Provide CLI report + dashboard widgets summarizing actions.
- **Data granularity**: per-contact/per-variant metrics stored in Supabase (`email_outbound`, `drafts`, `ai_interactions`, pattern analytics table), daily rollups, CLI exports.
- **Success tracking**: time-to-first-campaign, approval ratio, reply uplift vs baseline, provider error rate, AI SDK latency/cost per campaign, CLI usage frequency, Stage 3 trace explorer adoption, monthly pattern optimization decisions captured for audit.

## Next Steps
1. Finalize Supabase migrations for new tables (`segments`, `campaigns`, `drafts`, `email_outbound`, etc.).
2. Scaffold AI SDK client module with provider config + middleware for logging into `ai_interactions`/`api_traces`.
3. Align stakeholders on provider order (SMTP first, Smartlead optional later) and multilingual prompt priorities.
4. Define prompt pack governance workflow and benchmarking cadence leveraging AI SDK + Inspect harness.
