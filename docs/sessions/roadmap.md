# Sessions Roadmap – AI SDR GTM System

> Derived from `docs/AI_SDR_GTM_PRD.md` (v0.1, 2025-11-21). Each session should log detailed tasks/outcomes in `docs/sessions/YYYY-MM-DD_<n>_<slug>.md`.

## Phase 0.5 – Foundations
1. **Supabase Contract Freeze**
   - Verify existing `companies`/`employees` schema vs. Database Description.
   - Draft migrations for `segments`, `segment_members`, `campaigns`, `drafts`, `email_outbound`, `email_events`, `fallback_templates`.
2. **CLI/Repo Setup**
   - Scaffold TypeScript CLI skeleton with config loader.
   - Document initial commands (`gtm ingest`, `gtm segment create`, etc.).
3. **AI SDK Client & Contract Wiring**
   - Implement shared `generate_email_draft` wrapper with Strict/Express defaults.
   - Log AI interactions into Supabase stub tables.

## Phase 1 – Outreach MVP
1. **Segmentation Engine**
   - Build filter builder (UI + CLI parity) and segment snapshotting.
2. **Campaign Lifecycle**
   - Implement campaign creation flow with interaction/data-quality toggles.
   - Enforce spine contract from segment → email_outbound.
3. **Draft Generation & Review**
   - Orchestrator jobs calling AI SDK (Strict + Express default).
   - Approval UI/CLI plus audit logging.
4. **SMTP Adapter & Sending**
   - First-class SMTP integration, throttling, logging.
5. **Event Ingestion**
   - IMAP or webhook pipeline populating `email_events` (reply/outcome classification).

## Phase 2 – Enrichment & Judge
1. **Research Integrations**
   - Wire EXA/Parallels/Anysite adapters; populate `company_insights`/`employee_insights`.
2. **Graceful Mode Enablement**
   - Define fallback template catalog; unlock UI/CLI toggles once enrichment validated.
3. **LLM-as-a-Judge & Analytics**
   - Integrate evaluation runs, score logging, Pattern Breaker dashboards.

## Phase 3 – Trace Logging & Optimization
1. **AI Interactions + API Traces**
   - Capture model/router metadata end-to-end; build trace explorer UI.
2. **Interaction Mode Telemetry**
   - Track mode usage/errors, feed insights into product decisions.
3. **Prompt Experiments**
   - Automate A/B testing for pattern modes, analyze outcomes in analytics module.

## Ongoing
- Maintain PRD/appendix/changelog sync.
- Keep session logs updated per working session.
- Revisit roadmap quarterly as scope evolves.

## Session Plan to Completion

### Phase 0.5 – Foundations (Completed, newest first)
- 2025-11-21_4_campaign-snapshot-results: Segment versioning, snapshot enforcement in campaign create, CLI/tests/docs updated.
- 2025-11-21_3_segment-snapshot-results: Segment snapshot command/services/tests/docs delivered.
- 2025-11-21_2_cli-spine-implementation: CLI scaffold, env loader, services for segments/campaigns/drafts, AI stub, tests/README/AGENTS/CHANGELOG updated.
- 2025-11-21_1_initial-prd-and-structure: PRD v0.1, AI contract appendix, README/CHANGELOG, SMTP-first/strict-mode defaults recorded.

### Phase 1 – Outreach MVP (Completed, newest first)
- 2025-11-24_10_prompt-enrichment-feedback-loop-plan: Documented hooks/telemetry guidance for assume-now and reply pattern usage.
- 2025-11-24_9_reply-classification-and-patterns-plan: Reply classification/labels, pattern counts helper, tests.
- 2025-11-24_8_smartlead-outbound-wiring-plan: Smartlead send CLI with dry-run/batch-size, outbound recording, idempotency keys.
- 2025-11-24_7_smartlead-mcp-error-body-and-telemetry-plan: Capped error snippets, assume-now logging hook, retry cap env override.
- 2025-11-24_6_smartlead-mcp-final-consistency-pass: Single pull timestamp for assume-now; centralized retry cap; error codes.
- 2025-11-24_5_smartlead-mcp-retry-and-error-guidance: Retry-After handling with caps, non-mutating error cache, assume-now fallback flag.
- 2025-11-24_4_smartlead-mcp-polish-and-guardrails: Retry cap override, assume-now flag, improved occurred_at guidance.
- 2025-11-24_3_smartlead-mcp-idempotency-and-validation: Deterministic idempotency hash, enriched errors, CLI validation.
- 2025-11-24_2_smartlead-mcp-ingest-hardening: since/limit filters, idempotency guard, summaries.
- 2025-11-24_1_smartlead-mcp-ingest-plan: Smartlead MCP ingest-first wrapper/CLI and docs.
- 2025-11-23_10_campaign-status-cli-fix-and-draft-orchestrator: Status CLI guard/dry-run; draft orchestrator with dry-run/fail-fast/limit.
- 2025-11-23_9_campaign-state-and-draft-orchestrator: Status/validation plan for orchestrator.
- 2025-11-23_8_event-ingestion-stub: Event ingest stub with validation/dedupe/dry-run.
- 2025-11-23_7_send-cli-polish: Batch_id/fail-on-error/dry-run options; single summary log.
- 2025-11-23_6_smtp-send-logging-and-summary: Send summaries, formats, dry-run clarified.
- 2025-11-23_5_smtp-send-hardening: Throttle/duplicate guard/retry summary logging.
- 2025-11-23_4_campaign-status-next-steps: Added email send scaffold and documented status applicability.
- 2025-11-23_3_campaign-status-cli-wrap: Doc/test alignment pass for status/validation behavior.
- 2025-11-23_2_campaign-status-cli-finalize: Status map centralized, validation CLI formats/code, docs/tests updated.
- 2025-11-23_1_campaign-status-and-validation-next: Status/validation polish plan and execution.
- 2025-11-22_4_status-enforcement-and-validation: Status enforcement/validation UX refinements; structured CLI outputs and docs/tests updated.
- 2025-11-22_3_status-guardrails-and-filter-validation: Campaign status transition map, filter validation CLI/UX, docs/tests updated.
- 2025-11-22_2_hash-guardrails-and-updates: Snapshot hashing, force-version, guardrails, campaign update safety; docs/tests updated.
- 2025-11-22_1_next-session-plan: Plan completed for snapshot guardrails and minimal campaign update; DSL tightened; docs/tests updated.

### Phase 1 – Outreach MVP (Remaining sessions)
- None (current phase scope delivered). Use backlog to add top-N/date filters for reply patterns if scale requires.

### Phase 2 – Enrichment & Judge (Completed, newest first)
- 2025-11-25_4_backlog-hardening-plan: Graceful flag preview, Smartlead send dedupe/batch summary, reply pattern filters, judge validation tweaks, assume-now hook guidance.
- 2025-11-25_3_llm-judge-and-analytics-plan: Judge stub + CLI `judge:drafts` (dry-run/limit), scoring schema, tests.
- 2025-11-25_2_graceful-mode-enable-plan: Fallback template catalog/service with guard and tests.
- 2025-11-25_1_enrichment-integrations-stub-plan: Enrichment adapter registry (mock) and CLI `enrich:run` (dry-run/limit).

### Phase 3 – Trace Logging & Optimization (future sessions)
### Phase 3 – Trace Logging & Optimization (Completed, newest first)
- 2025-11-25_7_prompt-experiments-plan: Deterministic variant assignment/helpers, CLI variant flag for drafts (no UI), tests.
- 2025-11-25_6_interaction-telemetry-plan: Telemetry service, `--telemetry` opt-in on Smartlead commands, PII validation, tests.
- 2025-11-25_5_trace-logging-plan: Tracing service, AI + Smartlead MCP instrumentation, `--trace-file` flag, caps, tests.

### Phase 3 – Web UI Rollout (planned)
### Phase 3 – Web UI Rollout (Completed, newest first)
- 2025-11-25_13_web-ui-telemetry-and-ux-polish: Telemetry hook with tests; basic nav. Loading/error polish pending future.
- 2025-11-25_12_web-ui-settings-and-guardrails: Settings page (retry cap, assume-now, telemetry) with storage/tests.
- 2025-11-25_11_web-ui-events-and-patterns: Events/patterns mock page with filters.
- 2025-11-25_10_web-ui-send-control-and-summaries: Send page with dry-run/batch controls and summary (mock).
- 2025-11-25_9_web-ui-campaigns-and-drafts: Campaigns/Drafts views with mock API actions.
- 2025-11-25_8_web-ui-scaffold-and-api-bridge: React/Vite scaffold, mock API client, navigation; env/docs pending.
