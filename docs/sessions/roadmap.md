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

### Phase 0.5 – Foundations (Completed)
- 2025-11-21_1_initial-prd-and-structure: PRD v0.1, AI contract appendix, README/CHANGELOG, SMTP-first/strict-mode defaults recorded.
- 2025-11-21_2_cli-spine-implementation: CLI scaffold, env loader, services for segments/campaigns/drafts, AI stub, tests/README/AGENTS/CHANGELOG updated.
- 2025-11-21_3_segment-snapshot-results: Segment snapshot command/services/tests/docs delivered.
- 2025-11-21_4_campaign-snapshot-results: Segment versioning, snapshot enforcement in campaign create, CLI/tests/docs updated.
- 2025-11-22_1_next-session-plan: Plan completed for snapshot guardrails and minimal campaign update; DSL tightened; docs/tests updated.
- 2025-11-22_2_hash-guardrails-and-updates: Snapshot hashing, force-version, guardrails, campaign update safety; docs/tests updated.
- 2025-11-22_3_status-guardrails-and-filter-validation: Campaign status transition map, filter validation CLI/UX, docs/tests updated.
- 2025-11-22_4_status-enforcement-and-validation: Status enforcement/validation UX refinements; structured CLI outputs and docs/tests updated.
- 2025-11-23_1_campaign-status-and-validation-next: Status/validation polish plan and execution.
- 2025-11-23_2_campaign-status-cli-finalize: Status map centralized, validation CLI formats/code, docs/tests updated.
- 2025-11-23_3_campaign-status-cli-wrap: Doc/test alignment pass for status/validation behavior.
- 2025-11-23_4_campaign-status-next-steps: Added email send scaffold and documented status applicability.

### Phase 1 – Outreach MVP (remaining sessions)

**2025-11-22_2 Hash Guardrails & Updates (in-flight)**
- Overview: Enforce snapshot determinism (hash + force-version) and tighten campaign updates.
- Files: `src/filters/index.ts`, `src/services/segmentSnapshotWorkflow.ts`,
  `src/services/campaigns.ts`, `src/commands/campaignUpdate.ts`, `src/cli.ts`, docs/tests.
- Functions: `hashFilters(filters)` (stable hash of clauses), `ensureSegmentSnapshot(...)`
  (hash enforcement, force-version), `campaignUpdateHandler(...)` (block non-draft/ready updates),
  `parseSegmentFilters(...)` (better errors).
- Tests: `segmentSnapshotWorkflow.rejects_reuse_on_hash_mismatch`, `segmentSnapshotWorkflow.allows_force_version`,
  `campaignUpdate.blocks_non_draft`, `filters.supports_not_in_and_numeric`, `cli.force_version_passes_through`.

**Session: Campaign State Machine & Guardrails**
- Overview: Define allowed status transitions, enforce in handlers, and add clear errors for UI parity.
- Files: `src/services/campaigns.ts`, `src/commands/campaignCreate.ts`/`campaignUpdate.ts`,
  `src/cli.ts`, tests, README/changelog note.
- Functions: `updateCampaignStatus(client, id, next)` (validate transition map), `assertDraftState(...)`
  (shared guard), `registerStatusCommands(...)` (CLI wiring).
- Tests: `campaignStatus.rejects_invalid_transition`, `campaignStatus.allows_valid_transition_map`,
  `cli.campaign_status_update_wires_flags`.

**Session: Draft Generation Orchestrator**
- Overview: Add orchestrator to generate drafts with real AI client stub, status updates, error logging.
- Files: `src/services/drafts.ts`, `src/services/aiClient.ts`, `src/commands/draftGenerate.ts`,
  `src/cli.ts`, tests, README.
- Functions: `generateDrafts(...)` (batch with logging), `markDraftStatus(...)` (state updates),
  `AiClient.generateDraft` (stub with metadata).
- Tests: `drafts.generates_and_persists_metadata`, `drafts.skips_missing_requests`,
  `drafts.logs_errors_and_continues`, `cli.draft_generate_end_to_end_mocked`.

**Session: SMTP Adapter & Sending**
- Overview: Wire SMTP send pipeline with throttling and logging; keep Smartlead out.
- Files: `src/services/emailOutbound.ts` (new), `src/cli.ts` send command, README/changelog.
- Functions: `sendQueuedDrafts(smtpClient, options)` (throttle, log), `recordOutbound(...)`
  (persist provider ids), `buildSmtpMessage(...)` (from draft/contact snapshot).
- Tests: `emailOutbound.sends_and_records_ids`, `emailOutbound.respects_throttle`, `cli.send_command_executes_pipeline`.

**Session: Event Ingestion Stubs**
- Overview: Add webhook/IMAP stub handlers writing to `email_events`; simple outcome mapping.
- Files: `src/services/emailEvents.ts` (new), `src/commands/eventIngest.ts` (optional CLI),
  README/changelog.
- Functions: `ingestEmailEvent(payload)` (validate, persist), `mapProviderEvent(...)`
  (normalize types), `recordOutcome(...)` (write to `email_events`).
- Tests: `emailEvents.maps_and_persists_events`, `emailEvents.rejects_invalid_payload`,
  `cli.event_ingest_mocked_flow`.

### Phase 2 – Enrichment & Judge (future sessions)

**Session: Enrichment Integrations Stub**
- Overview: Add adapter scaffolds for EXA/Parallels/Anysite; no live calls, mockable.
- Files: `src/services/enrichment/*.ts`, `src/cli.ts` command, README.
- Functions: `fetchCompanyInsights(adapter, input)`, `fetchEmployeeInsights(...)`,
  `enrichSegmentMembers(...)` (batched).
- Tests: `enrichment.dispatches_to_adapter`, `enrichment.stores_insights_mock`, `cli.enrich_command_mocked`.

**Session: Graceful Mode Enablement**
- Overview: Define fallback template catalog and gate graceful mode toggles.
- Files: `supabase/migrations` (templates table if needed), `src/services/fallbackTemplates.ts`,
  `src/cli.ts`, README/appendix.
- Functions: `getFallbackTemplate(category, locale)`, `applyGracefulFallback(...)` (inject template
  when data missing), `ensureGracefulToggle(...)` (guard).
- Tests: `fallback.fetches_template`, `graceful.applies_template_on_missing_data`,
  `cli.graceful_toggle_rejected_without_catalog`.

**Session: LLM Judge & Analytics**
- Overview: Add judge scaffold to score drafts and log outcomes for Pattern Breaker dashboards.
- Files: `src/services/judge.ts`, `tests/judge.test.ts`, `supabase` metadata fields, README.
- Functions: `scoreDraft(aiJudge, draft)` (returns scores/reasons), `recordJudgement(...)`
  (persist to drafts/analytics).
- Tests: `judge.scores_and_persists`, `judge.rejects_missing_inputs`.

### Phase 3 – Trace Logging & Optimization (future sessions)

**Session: Trace Logging**
- Overview: Capture AI/router metadata and store per interaction; expose basic query.
- Files: `src/services/tracing.ts`, `src/services/aiClient.ts` (emit trace), `tests/tracing.test.ts`,
  README.
- Functions: `startTrace(...)`, `finishTrace(...)`, `recordTrace(...)`.
- Tests: `tracing.records_model_and_latency`, `tracing.links_to_draft`.

**Session: Interaction Mode Telemetry**
- Overview: Track mode usage/errors; wire metrics events.
- Files: `src/services/telemetry.ts`, CLI hooks, README.
- Functions: `emitTelemetry(event, payload)`, `validateTelemetryContext(...)`.
- Tests: `telemetry.emits_on_cli_actions`, `telemetry.rejects_invalid_payload`.

**Session: Prompt Experiments**
- Overview: Add A/B hooks for prompts/pattern modes and logging.
- Files: `src/services/experiments.ts`, `tests/experiments.test.ts`, README.
- Functions: `assignVariant(subject)`, `recordExperimentResult(...)`.
- Tests: `experiments.assigns_deterministically`, `experiments.records_outcome`.
