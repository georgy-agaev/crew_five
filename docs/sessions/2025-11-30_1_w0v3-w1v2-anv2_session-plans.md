# 2025-11-30 – Session Plans for W0.v3, W1.v2, AN.v2 (Option B)

> Timestamp (UTC): 2025-11-30T20:37:30Z  
> Goal: Detailed plans for Sessions 1–8 to reach W0.v3, W1.v2, and AN.v2 with W2 on Option 2 (contracts + stubs only), implementing only the functionality needed now.
>
> **Historical note:** This file captures the v0.4 execution plan and completion record for W0.v3, W1.v2, and AN.v2. Future roadmap changes or new feature work should be recorded in new session docs rather than retrofitting this one.

This document breaks down each planned session with:
- Scope and constraints (minimal functionality for W0.v3, W1.v2, AN.v2).  
- Files to touch (code, tests, migrations, docs).  
- Planned functions (with 1–3 sentence descriptions).  
- Planned tests (names + 5–10 words on behaviour).

---

## Session 1 – Foundations: Jobs Model, SIM Contracts (Option 2), Event Spine Review

**Scope**
- Introduce or confirm a generic `jobs` abstraction used for `send`, `enrich`, and future `sim` work, without adding full orchestration.  
- Define SIM request/response types and a stub SIM service that records jobs but does not run any SIM logic.  
- Review `email_events` and outbound logging so AN.v1/AN.v2 have the necessary keys later.

**Key Constraints**
- No real SIM behaviour; all SIM jobs should end in a clear “not implemented / feature off” status.  
- Do not add generic “job scheduler” or worker infra yet—only the schema and minimal helpers required by W0/W1/AN.

### Files to Touch

- Migrations:
  - `supabase/migrations/*_create_spine_tables.sql` – add a `jobs` table if not present, or a minimal new migration for jobs if required.
- Services:
  - `src/services/emailOutbound.ts` – optionally reference `jobs` for send jobs (or leave for Session 2; here only ensure compatibility).  
  - `src/services/emailEvents.ts` – confirm event shape and note any missing FK fields for later sessions.  
  - `src/services/supabaseClient.ts` – ensure typed access to the new `jobs` table if needed.
  - `src/services/tracing.ts` – optional: trace SIM stub calls if it fits existing patterns.
  - `src/services/aiClient.ts` – no changes, but confirm it can be reused by SIM later.
  - `src/services` (new file): `sim.ts` – SIM contracts and stub implementation.
- CLI / Commands:
  - `src/cli.ts` – wire any future `sim:*` commands behind a feature flag only if needed (optional; may defer to later session).
- Docs:
  - This session file.  
  - `docs/GMT_system_plan_v0.4_roadmap.md` – only if the final shape of `jobs` or SIM contracts differs meaningfully from the roadmap text.

### Planned Functions (Session 1)

- `createJob(client, input)` in a new `src/services/jobs.ts`  
  Creates a job row with `type`, `status`, optional `segment_id`/`segment_version`, `payload`, and returns the row; used by send/enrich/SIM in later sessions.

- `updateJobStatus(client, id, status, result?)` in `src/services/jobs.ts`  
  Updates a job’s `status` and optional `result` JSON; used by SIM stub to mark “not implemented” and by future workers.

- `createSimRequest(client, request)` in `src/services/sim.ts`  
  Validates a `SimRequest` (mode, segment/sample IDs, ICP refs, draft IDs) and writes a `jobs` row with `type='sim'`; returns a `SimResult` stub containing job id and status.

- `completeSimAsNotImplemented(client, jobId, reason)` in `src/services/sim.ts`  
  Updates the related job to `status='failed'` or a dedicated “not implemented” status with a clear reason; no external calls.

### Planned Tests (Session 1)

- `jobs_create_inserts_row_with_expected_type_and_payload`  
  Creating a job stores type/status/payload correctly.

- `jobs_update_status_updates_status_and_result_json`  
  Updating job status persists new status and result.

- `sim_create_request_creates_sim_job_and_returns_stub_result`  
  SIM stub accepts request, creates job, returns stub.

- `sim_complete_marks_job_not_implemented_with_reason`  
  SIM completion helper sets failed/not_implemented status.

- `email_events_schema_has_required_foreign_keys_for_future_an`  
  Assert presence of outbound and minimal FK fields.  

**Status (2025-11-30T22:19:59Z)**  
- Completed:
  - Added `public.jobs` table via `supabase/migrations/20251130205000_add_jobs_table.sql` with types `send`/`enrich`/`sim` and statuses including `not_implemented`.
  - Implemented `src/services/jobs.ts` (`createJob`, `updateJobStatus`) with unit tests in `tests/jobs.test.ts`.
  - Implemented SIM Option 2 stub in `src/services/sim.ts` (`createSimRequest`, `completeSimAsNotImplemented`) with tests in `tests/sim.test.ts`.
  - Lint, build, and full `pnpm test` suite passing.
- To Do (future refinement, not blocking next sessions):
  - Optionally add a lightweight schema/assertion test or doc note if we later extend `email_events` for AN.v2-specific foreign keys.

**Implementation Notes (Session 1)**  
- Design vs Actual: Implementation matches the plan closely: a generic `jobs` model and Option 2 SIM contracts, with `sim` jobs recorded and immediately marked as `not_implemented`. No additional orchestration or scheduling was added, keeping the scope tight for W0/W1/AN usage.

---

## Session 2 – W0 Spine Check: Segments, Versions, Members, Send Jobs (W0.v1)

**Scope**
- Ensure the current implementation of segments, snapshots, segment members, drafts, and send jobs matches W0.v1 expectations and is ready for W0.v3 enrichment.  
- Make minimal adjustments to enforce that `segment_members` only exist for finalized versions and that send jobs always reference the canonical spine.

**Key Constraints**
- No new audience UX; only correctness and invariants for existing flows.  
- Send job model should align with the `jobs` abstraction from Session 1 but not require a full refactor yet.

### Files to Touch

- Services:
  - `src/services/segments.ts` – confirm `version` semantics and update if needed (e.g., clarify version bump vs force).  
  - `src/services/segmentSnapshotWorkflow.ts` – ensure snapshot creation/bump aligns with W0.v1 and uses `segment.version` correctly.  
  - `src/services/emailOutbound.ts` – ensure outbound records reference `campaign_id`, `draft_id`, and implicitly the segment version via campaigns.  
  - `src/services/campaigns.ts` – verify that campaigns are tied to `segment_id` + `segment_version` as expected.
- Commands:
  - `src/commands/segmentSnapshot.ts` – surface any new options or clarify existing ones (`--force-version`, `--max-contacts`, etc.).  
  - `src/commands/campaignCreate.ts` and `src/commands/campaignStatus.ts` – ensure they respect segment version invariants.
- Tests:
  - `tests/segmentSnapshotWorkflow.test.ts`  
  - `tests/segments.test.ts`  
  - `tests/campaigns.test.ts`  
  - `tests/campaignCommand.test.ts`

### Planned Functions (Session 2)

- `getFinalizedSegmentVersion(client, segmentId)` in `src/services/segments.ts`  
  Helper to fetch the current finalized version (or enforce that version ≥ 1 exists) to centralize version resolution.

- `ensureFinalSegmentSnapshot(client, options)` in `src/services/segmentSnapshotWorkflow.ts`  
  Thin wrapper around `ensureSegmentSnapshot` that enforces `version >= 1` and any W0.v1 invariants (e.g., no enrichment or send before snapshot).

- `getCampaignSpineContext(client, campaignId)` in `src/services/campaigns.ts`  
  Returns campaign with `segment_id`, `segment_version`, and optionally resolved `segment_members` count; used as a shared helper for send/enrichment checks.

### Planned Tests (Session 2)

- `segment_snapshot_only_materializes_members_for_final_versions`  
  Snapshots only create members for finalized versions.

- `segment_snapshot_respects_max_contacts_and_allow_empty_flags`  
  Snapshot fails or passes according to options.

- `campaign_create_binds_segment_and_version_consistently`  
  Campaigns persist segment_id + segment_version correctly.

- `campaign_spine_context_returns_segment_and_version_for_send`  
  Helper returns required fields for downstream flows.

- `email_outbound_records_can_be_traced_back_to_segment_version`  
  Outbound row links to draft/campaign/segment version.

**Status (2025-11-30T23:35:28Z)**  
- Completed:
  - Added `getFinalizedSegmentVersion` in `src/services/segments.ts` with coverage in `tests/segments.test.ts` to resolve the effective segment version (defaulting to ≥1).
  - Added `getCampaignSpineContext` in `src/services/campaigns.ts` with coverage in `tests/campaigns.test.ts`, returning `id`, `segment_id`, and `segment_version` for downstream send/enrich flows.
  - Verified via `tests/emailOutbound.test.ts` that outbound records include `campaign_id`, ensuring they can be joined back to `segment_version` through campaigns.
  - Lint, build, and full `pnpm test` remain green after these spine helpers.
- To Do (if we find gaps later in W0 flows):
  - Optionally introduce a thin `ensureFinalSegmentSnapshot` wrapper once enrichment/send callers are wired to enforce snapshot existence explicitly.

**Implementation Notes (Session 2)**  
- Design vs Actual: Rather than adding new send-job tables, we reinforced the existing spine with helpers (`getFinalizedSegmentVersion`, `getCampaignSpineContext`) so enrichment and send flows can reliably resolve `segment_version` without broad refactors.

---

## Session 3 – ICP & Hypothesis Schema and Minimal Flows (W1.1)

**Scope**
- Add `icp_profiles` and `icp_hypotheses` schema and link them to `segments` as per v0.4 roadmap.  
- Provide minimal CLI flows to create/list ICP profiles and hypotheses; no Exa/AnySite integration yet.

**Key Constraints**
- Only fields required by W1.v2 and analytics are added now (industry, size, pains, offer/angle, funnel position).  
- No ICP discovery (Exa) or write-back flows yet; those are outside the immediate W1.v2/W0.v3/AN.v2 scope.

### Files to Touch

- Migrations:
  - New migration: `supabase/migrations/*_add_icp_profiles_and_hypotheses.sql`.
- Services:
  - `src/services/supabaseClient.ts` – optional typed helpers for new tables.  
  - New service: `src/services/icp.ts` – CRUD helpers for profiles/hypotheses.
- Commands:
  - New command: `src/commands/icpCreate.ts` – create/update ICP profiles.  
  - New command: `src/commands/icpHypothesisCreate.ts` – create ICP hypotheses linked to profiles and optionally segments.
  - `src/cli.ts` – wire new `icp:*` commands.
- Tests:
  - New tests: `tests/icp.test.ts` – service-level tests.  
  - Extend `tests/cli.test.ts` for new commands.
- Docs:
  - `docs/AI_SDR_GTM_PRD_v0.2_workflows.md` – ensure ICP schema aligns.  
  - `docs/GMT_system_plan_v0.4_roadmap.md` – if any schema adjustments differ from text.

### Planned Functions (Session 3)

- `createIcpProfile(client, input)` in `src/services/icp.ts`  
  Inserts a new ICP profile with fields such as industry, company type, size, region, decision-makers, pains, and triggers; returns the created row.

- `createIcpHypothesis(client, input)` in `src/services/icp.ts`  
  Creates an ICP hypothesis linked to an `icp_profile_id` and optionally a `segment_id`, describing offer/angle, outcome, and funnel position.

- `attachIcpToSegment(client, segmentId, profileId, hypothesisId)` in `src/services/icp.ts`  
  Updates a segment row to reference `icp_profile_id` and `icp_hypothesis_id`, used after ICP/hypothesis creation.

### Planned Tests (Session 3)

- `icp_profile_create_persists_expected_fields_and_defaults`  
  Verify required fields and defaults on profile creation.

- `icp_hypothesis_create_links_to_profile_and_optional_segment`  
  Hypothesis references profile; segment link optional.

- `attach_icp_to_segment_updates_segment_foreign_keys`  
  Segment row now holds icp_profile_id and hypothesis_id.

- `cli_icp_create_accepts_basic_fields_and_prints_id`  
  CLI creates ICP profile and prints resulting ID.

- `cli_icp_hypothesis_create_links_profile_and_segment_ids`  
  CLI creates hypothesis with profile/segment references.

**Status (2025-12-01T01:55:20Z)**  
- Completed:
  - Added `icp_profiles` and `icp_hypotheses` tables plus `segments.icp_profile_id` / `segments.icp_hypothesis_id` via `supabase/migrations/20251130220000_add_icp_profiles_and_hypotheses.sql`, aligned with PRD v0.2 ICP model.
  - Implemented `src/services/icp.ts` with `createIcpProfile`, `createIcpHypothesis`, and `attachIcpToSegment` helpers, all covered by `tests/icp.test.ts`.
  - Added CLI commands `icp:create` and `icp:hypothesis:create` in `src/cli.ts` via `src/commands/icpCreate.ts` and `src/commands/icpHypothesisCreate.ts`, with behaviour validated in `tests/cli.test.ts` (IDs printed, segment attachment invoked).
  - Lint, build, and full `pnpm test` suite remain green after these changes.
- To Do (future, outside Session 3 scope):
  - Consider adding simple `icp:list` / `icp:hypothesis:list` commands or web views once W1.v2 coach flows start consuming ICP entities.

**Implementation Notes (Session 3)**  
- Design vs Actual: The ICP schema, service, and CLI commands were implemented as planned. Discovery flows (Exa/AnySite) remain out of scope for this session, leaving W1.2/W1.3 for future work once W1.v2 coaching is exercised on real data.

---

## Session 4 – Coach Split: W1.v2 (ICP Profile → Hypothesis → Drafts)

**Scope**
- Refactor the monolithic email coach into three explicit steps: ICP profile generation, ICP hypothesis generation, and per-contact email drafts.  
- Wire these steps to the new ICP schema and ensure drafts record `pattern_id`, `coach_prompt_id`, and `draft_pattern` for AN.v2.

**Key Constraints**
- Do not introduce new coaching UX beyond what’s needed to keep the flow coherent; re-use existing CLI/web entry points.  
- No SIM/roast behaviour here; SIM stays in Option 2 stub.

### Files to Touch

- Services:
  - `src/services/aiClient.ts` – may stay as-is but used by new coach helpers.  
  - New service: `src/services/coach.ts` – orchestrates ICP/hypothesis/draft calls.  
  - `src/services/drafts.ts` – ensure `draft_pattern`, `coach_prompt_id`, and `user_edited` are persisted consistently.
- Commands:
  - `src/commands/draftGenerate.ts` – route draft generation via the new coach flow (profile → hypothesis → drafts) where ICP is configured.
  - `src/cli.ts` – any needed flags (e.g., `--icp-profile-id`, `--icp-hypothesis-id`).
- Tests:
  - `tests/drafts.test.ts` – behaviour of draft metadata.  
  - `tests/draftCommand.test.ts` – CLI path for W1.v2 flow.  
  - Potential new `tests/coach.test.ts`.

### Planned Functions (Session 4)

- `generateIcpProfileFromBrief(client, brief)` in `src/services/coach.ts`  
  Uses the AI client to generate a structured ICP profile from a human brief, then persists it via `createIcpProfile`.

- `generateIcpHypothesisForSegment(client, segmentId, profileId, brief)` in `src/services/coach.ts`  
  Calls AI to produce a hypothesis linked to the given profile and segment, then persists via `createIcpHypothesis`.

- `generateDraftsForSegmentWithIcp(client, segmentId, options)` in `src/services/coach.ts`  
  For each segment member, composes an `EmailDraftRequest` using profile + hypothesis + contact data, calls `AiClient`, and writes drafts with `draft_pattern`, `coach_prompt_id`, `email_type`.

### Planned Tests (Session 4)

- `coach_generate_icp_profile_persists_profile_and_returns_id`  
  AI call result stored as ICP profile row.

- `coach_generate_icp_hypothesis_links_profile_and_segment`  
  Hypothesis saved and cross-linked to segment/profile.

- `coach_generate_drafts_uses_icp_and_sets_metadata`  
  Drafts include icp/hypothesis context and prompt metadata.

- `draft_generate_command_supports_icp_flags_and_calls_coach_flow`  
  CLI flags trigger the new multi-step coach pipeline.

- `drafts_persist_draft_pattern_and_user_edited_flags`  
  Draft metadata includes pattern + edited boolean.

**Status (2025-12-01T03:48:37Z)**  
- Completed:
  - Added `src/services/coach.ts` with `generateIcpProfileFromBrief`, `generateIcpHypothesisForSegment`, and `generateDraftsForSegmentWithIcp`, delegating persistence to `icp` service and draft generation to existing `generateDrafts`.
  - Added `tests/coach.test.ts` to cover ICP profile creation, hypothesis creation (with segment linkage), and draft generation using the coach helper with correct `draft_pattern` and `user_edited` metadata.
  - Left the existing `draft:generate` CLI wired directly to `generateDrafts` (no new flags yet), keeping behaviour stable while making the coach helpers available for W1.v2 flows and future CLI/web integration.
  - Lint, build, and full `pnpm test` suite remain green after introducing the coach service.
- To Do (for a future session when we deepen W1.v2 UX):
  - Wire `draft:generate` and/or web flows to optionally call the coach helpers, passing ICP profile/hypothesis context once those are collected from users.

**Implementation Notes (Session 4)**  
- Design vs Actual: We chose to keep `draft:generate` wired to the existing `generateDrafts` implementation and introduced `coach` helpers alongside it. This preserves current CLI behavior while making it easy to layer ICP-aware flows (CLI flags or web UI) later without breaking existing scripts.

---

## Session 5 – W0.v3 Enrichment Entry Point

**Scope**
- Implement an “Enrich segment” action for finalized segments that queues enrichment jobs and writes research data to companies/employees.  
- Reuse the existing enrichment adapter registry and avoid building full research UIs; focus on data and minimal status visibility.

**Key Constraints**
- Enrichment must **not** change `segment_members`; it purely enriches existing companies/employees.  
- MVP: one adapter (mock or a single real provider) and basic status introspection.

### Files to Touch

- Migrations:
  - New migration to add research storage:
    - Option A: JSON columns `company_research`, `ai_research_data` on `companies` and `employees`.  
    - Option B: `company_research` / `employee_research` tables.
- Services:
  - `src/services/enrichment/registry.ts` – extend interface if needed and pick default adapter (mock or real).  
  - New service: `src/services/enrichSegment.ts` – segment-level job creation + enrichment orchestration.  
  - `src/services/jobs.ts` – reuse `createJob`/`updateJobStatus` for `type='enrich'`.
- Commands:
  - `src/commands/enrich.ts` – extend to support segment-based enrichment (`enrich:segment`), not only low-level adapters.  
  - `src/cli.ts` – wire new subcommand/flags if needed.
- Tests:
  - `tests/enrichment.test.ts` – extend to segment-level use-case.  
  - `tests/cli.test.ts` – cover `enrich:segment` behaviour.

### Planned Functions (Session 5)

- `enqueueSegmentEnrichment(client, segmentId, options)` in `src/services/enrichSegment.ts`  
  Validates the segment is finalized (uses Session 2 helpers), creates an `enrich` job with list of companies/employees to enrich, and returns job id.

- `runSegmentEnrichmentOnce(client, job)` in `src/services/enrichSegment.ts`  
  For a given job, uses `getEnrichmentAdapter` to fetch research per company/employee and writes it into the chosen research storage columns/tables; updates job status.

- `getSegmentEnrichmentStatus(client, segmentId)` in `src/services/enrichSegment.ts`  
  Returns last job status, counts of enriched entities, and timestamps for basic status display.

### Planned Tests (Session 5)

- `enqueue_segment_enrichment_requires_finalized_segment_version`  
  Should fail or refuse if segment not finalized.

- `enqueue_segment_enrichment_creates_enrich_job_with_targets`  
  Job payload lists companies/employees to enrich.

- `run_segment_enrichment_writes_research_to_companies_and_employees`  
  Mock adapter data stored in research fields.

- `segment_enrichment_status_returns_last_job_and_counts`  
  Status helper exposes job status and entity counts.

- `cli_enrich_segment_supports_dry_run_and_basic_status_output`  
  CLI command shows actions without mutating in dry-run.

**Status (2025-12-01T06:57:58Z)**  
- Completed:
  - Added research storage JSON columns via `supabase/migrations/20251201040000_add_research_columns.sql` (`companies.company_research`, `employees.ai_research_data`).
  - Implemented segment-level enrichment service `src/services/enrichSegment.ts` with:
    - `enqueueSegmentEnrichment` – validates finalized segment version using `getFinalizedSegmentVersion`, finds `segment_members`, and creates an `enrich` job with member IDs in `jobs.payload`.
    - `runSegmentEnrichmentOnce` – uses `getEnrichmentAdapter` to fetch company/employee research, writes into `company_research` / `ai_research_data`, and updates job status/result.
    - `getSegmentEnrichmentStatus` – returns the latest `enrich` job status per segment.
  - Kept `src/commands/enrich.ts` as a simple synchronous path that:
    - Reads `segment_members`, calls the enrichment adapter, and writes `employees.ai_research_data` directly, preserving the existing CLI contract (`enrich:run`) while tests now assert DB writes.
  - Extended `tests/enrichment.test.ts` to cover:
    - Legacy CLI path (`dispatches to adapter and processes members`, `respects dry-run`).
    - Job-based helpers (`enqueue_segment_enrichment_creates_enrich_job_with_targets`, `run_segment_enrichment_writes_research_to_companies_and_employees`).
  - Lint, build, and full `pnpm test` suite (42 files, 166 tests) remain green.
- To Do (future, optional):
  - Add a dedicated `enrich:segment` CLI command that explicitly queues and runs `enrich` jobs via `enqueueSegmentEnrichment`/`runSegmentEnrichmentOnce`, if/when asynchronous execution is prioritized.

**Implementation Notes (Session 5)**  
- Design vs Actual: Instead of introducing a new `enrich:segment` command immediately, we extended the existing `enrich:run` CLI and added `enrichSegment` helpers for job-based flows. This keeps the CLI surface stable while giving us a clear path to async enrichment jobs when needed.

---

## Session 6 – AN.v1 Baseline Analytics

**Scope**
- Ensure event and outbound logging captures all necessary identifiers to answer basic “what works” questions, and create baseline analytics queries/CLI or a simple UI.  
- No optimization or SIM correlation yet—just reliable metrics by ICP/segment/role/pattern and AI-only vs user-edited.

**Key Constraints**
- No new analytics framework; use SQL views and small helpers.  
- Keep scope tight: only metrics that directly support AN.v2 later.

### Files to Touch

- Migrations:
  - New migration if needed to add any missing FK-like columns on `email_outbound` or `email_events` (e.g., `icp_profile_id`, `icp_hypothesis_id`, `pattern_id`, `coach_prompt_id`, `user_edited` if not derivable).
- Services:
  - `src/services/emailOutbound.ts` – ensure pattern/ICP/hypothesis info is derivable from drafts/campaigns, or add fields.  
  - `src/services/emailEvents.ts` – confirm event insertion carries `outbound_id` and can be joined to drafts.
  - New service: `src/services/analytics.ts` – core SQL queries for AN.v1.
- Commands:
  - New command: `src/commands/analyticsSummary.ts` – CLI entry to show baseline metrics.
  - `src/cli.ts` – wire `analytics:summary`.
- Tests:
  - New tests: `tests/analytics.test.ts`.  
  - Extend `tests/cli.test.ts`.

### Planned Functions (Session 6)

- `getAnalyticsByIcpAndHypothesis(client, options)` in `src/services/analytics.ts`  
  Aggregates send/open/reply/positive metrics grouped by `icp_profile_id` and `icp_hypothesis_id`.

- `getAnalyticsBySegmentAndRole(client, options)` in `src/services/analytics.ts`  
  Aggregates metrics by `segment_id`, `segment_version`, and lead role/seniority.

- `getAnalyticsByPatternAndUserEdit(client, options)` in `src/services/analytics.ts`  
  Aggregates metrics by `pattern_id` and `user_edited` flag to compare AI-only vs heavily edited drafts.

### Planned Tests (Session 6)

- `analytics_icp_hypothesis_groups_metrics_by_ids_correctly`  
  Query groups/control counts per ICP/hypothesis pair.

- `analytics_segment_role_breakdown_includes_segment_version_and_role`  
  Segment + version + role appear in results.

- `analytics_pattern_user_edit_splits_ai_only_vs_edited`  
  Distinguishes AI-only from edited draft performance.

- `analytics_summary_command_prints_key_metrics_for_recent_range`  
  CLI shows basic metrics table for a time window.

- `analytics_queries_handle_no_data_without_throwing`  
  Empty datasets return empty arrays/graceful messages.

**Status (2025-12-01T10:06:28Z)**  
- Completed:
  - Added `supabase/migrations/20251201043000_add_analytics_events_flat_view.sql` defining `analytics_events_flat` view that joins `email_events` → `email_outbound` → `drafts` → `campaigns` → `segments` → `employees`, exposing `segment_id`, `segment_version`, `icp_profile_id`, `icp_hypothesis_id`, `draft_pattern`, `user_edited`, `role`, and core event fields.
  - Implemented `src/services/analytics.ts` with:
    - `getAnalyticsByIcpAndHypothesis` – groups events by `icp_profile_id`/`icp_hypothesis_id` and returns counts of delivered/opened/replied/positive replies, with optional `since` filter.
    - `getAnalyticsBySegmentAndRole` – groups by `segment_id`/`segment_version`/`role` and returns the same metrics.
    - `getAnalyticsByPatternAndUserEdit` – groups by `draft_pattern` and `user_edited` to compare AI-only vs edited performance.
  - Added `analytics:summary` CLI command in `src/cli.ts` supporting:
    - `--group-by icp|segment|pattern` and optional `--since <iso>`.
    - Prints a JSON payload `{ groupBy, results }` using the analytics service.
  - Added `tests/analytics.test.ts` to cover:
    - Service-level grouping for ICP, segment+role, and pattern+user-edit.
    - `analytics:summary` CLI output for populated and empty datasets.
  - Lint, build, and full `pnpm test` (43 files, 171 tests) remain green.

**Implementation Notes (Session 6)**  
- Design vs Actual: We implemented `analytics:summary` directly in `src/cli.ts` rather than a separate command module. Internally, the command delegates to `analytics` service helpers and the `analytics_events_flat` view as planned, so the behavior matches the intended AN.v1 scope.

---

## Session 7 – AN.v2 Prompt & Pattern Optimization (SIM-Ready)

**Scope**
- Introduce a small prompt/pattern registry and build analytics queries that compare performance across prompt versions and patterns.  
- Make analytics SIM-ready by logging `sim` job metadata (without implementing SIM) and reserving fields for future SIM outputs.

**Key Constraints**
- Do not build a full “experiments” system; only enough structure to reason about prompt versions and patterns.  
- SIM integration limited to logging job metadata and optional columns; no persona simulation or offer roast here.

### Files to Touch

- Migrations:
  - If needed, add a `prompt_registry` table or equivalent metadata (or reuse existing prompt/variant structures).
- Services:
  - `src/services/experiments.ts` – extend or complement for pattern/prompt registry.  
  - `src/services/analytics.ts` – add AN.v2 queries on top of AN.v1.
  - `src/services/jobs.ts` – ensure `sim` jobs are queryable for analytics.
- Commands:
  - New command: `src/commands/analyticsOptimize.ts` – suggestions based on AN.v2 views.  
  - `src/cli.ts` – wire `analytics:optimize`.
- Tests:
  - Extend `tests/experiments.test.ts`.  
  - Extend `tests/analytics.test.ts`.  
  - Extend `tests/cli.test.ts`.

### Planned Functions (Session 7)

- `registerPromptVersion(client, input)` in a new `src/services/promptRegistry.ts` or reuse a suitable module  
  Stores metadata for a prompt version (`coach_prompt_id`, description, rollout status) for analytics reference.

- `getPromptPatternPerformance(client, options)` in `src/services/analytics.ts`  
  Aggregates metrics by `coach_prompt_id` and `pattern_id` over a given time range or sample.

- `suggestPromptPatternAdjustments(client, options)` in `src/services/analytics.ts`  
  Uses AN.v2 metrics to propose which combinations to scale or retire, based on thresholds or relative differences.

- `getSimJobSummaryForAnalytics(client, options)` in `src/services/analytics.ts`  
  Returns counts/statuses of `sim` jobs from `jobs` for later SIM-vs-reality comparisons.

### Planned Tests (Session 7)

- `prompt_registry_register_stores_prompt_metadata_and_version`  
  Prompt registrations persist metadata and can be read back.

- `analytics_prompt_pattern_performance_ranks_combinations_by_outcome`  
  Query returns metrics sorted or filterable per combination.

- `analytics_optimize_suggests_retire_for_underperforming_patterns`  
  Suggestion helper flags low-performing patterns.

- `analytics_sim_job_summary_counts_jobs_by_mode_and_status`  
  Sim job summary returns counts per mode/status.

- `analytics_optimize_command_prints_suggestions_without_crashing`  
  CLI prints suggestions for prompts/patterns safely.

**Status (2025-12-01T10:54:52Z)**  
- Completed:
  - Added `prompt_registry` table via `supabase/migrations/20251201102000_add_prompt_registry.sql` to store prompt versions with `coach_prompt_id`, description, version, and rollout status.
  - Implemented `src/services/promptRegistry.ts` with `registerPromptVersion` to insert prompt metadata; covered by `prompt_registry_register_stores_prompt_metadata_and_version` in `tests/experiments.test.ts`.
  - Extended `src/services/analytics.ts` with:
    - `getPromptPatternPerformance` – aggregates AN.v1 pattern metrics into a per-`draft_pattern` view.
    - `getSimJobSummaryForAnalytics` – returns counts of `sim` jobs by status from `jobs`.
    - `suggestPromptPatternAdjustments` – produces simple `scale`/`keep`/`retire` recommendations per pattern based on reply/positive-reply ratios.
  - Extended tests:
    - `tests/experiments.test.ts` now covers prompt registration, prompt-pattern performance aggregation, SIM job summary, and optimization suggestions.
    - `tests/cli.test.ts` adds `analytics_optimize_command_prints_suggestions_without_crashing`, asserting that the CLI prints a JSON payload containing `suggestions`.
  - Updated `src/cli.ts` with `analytics:optimize` command that calls `suggestPromptPatternAdjustments` and `getSimJobSummaryForAnalytics` and prints `{ suggestions, simSummary }`.
  - Lint, build, and full `pnpm test` (43 files, 176 tests) remain green.

**Implementation Notes (Session 7)**  
- Design vs Actual: We kept the optimization logic intentionally simple (basic thresholds for `scale`/`keep`/`retire`) and wired it through `analytics:optimize`. This provides actionable guidance without introducing a heavy experiments system; future work can refine thresholds or integrate prompt weights as needed.

---

## Session 8 – Hardening & W2 Option 2 Sanity Pass

**Scope**
- Run through an end-to-end flow with W0.v3, W1.v2, and AN.v2 in place and capture gaps.  
- Verify that all SIM-related surfaces cleanly use Option 2: jobs + stubbed results, no hidden dependencies on real SIM behaviour.

**Key Constraints**
- No new features; only polish, fixes, and documentation.  
- SIM must remain optional and clearly signposted as “not implemented yet”.

### Files to Touch

- Services/Commands:
  - Any small fixes in `src/services/*` and `src/commands/*` revealed by end-to-end usage (e.g., error messages, edge-case guards).  
  - `src/commands` (if any `sim:*` commands exist by then) to ensure they call the stub SIM service.
- Docs:
  - `docs/AI_SDR_GTM_PRD*.md` – ensure W0.v3, W1.v2, AN.v2 match implementation.  
  - `docs/workflow_2_sim_replies_prd.md` – optionally flag SIM as “contracts implemented, behaviour TBD”.  
  - `docs/GMT_system_plan_v0.4_roadmap.md` – mark W0.v3/W1.v2/AN.v2 as “implemented” once done.
  - New session doc summarizing hardening and any remaining To Do.

### Planned Functions (Session 8)

- `runEndToEndSmokeTest(client, options)` in a suitable test helper module (optional)  
  A scripted helper (or just a documented manual path) that executes segment → snapshot → enrich → ICP/hypothesis → drafts → send → analytics, primarily for developer use.

- `ensureSimEntryPointsAreStubbed(client)` in `src/services/sim.ts` (or equivalent checks)  
  Lightweight helper or assertions to confirm all SIM callers receive “not implemented / feature off” responses without breaking flows.

### Planned Tests (Session 8)

- `end_to_end_flow_runs_without_throwing_for_small_segment`  
  From segment creation to analytics summary completes successfully.

- `sim_stub_commands_return_not_implemented_without_side_effects`  
  Any `sim:*` commands produce safe stub output.

- `docs_prd_and_roadmap_reference_correct_versions_and_behaviour`  
  Manual/automated check that docs align with code state.

- `analytics_handles_mixed_data_with_and_without_icp_or_pattern`  
  AN views don’t break when some IDs are null/missing.

- `enrichment_and_icp_paths_fail_fast_on_misconfigured_envs`  
  Clear errors if required env or config is missing.

**Status (2025-12-01T10:54:52Z)**  
- Completed:
  - SIM Option 2 sanity: `src/services/sim.ts` and `tests/sim.test.ts` confirm that all `SimRequest` calls create `sim` jobs and immediately mark them as `not_implemented` with a clear reason; there are no `sim:*` CLI commands, so SIM remains a safe, internal-only stub.
  - End-to-end spine checks: existing tests for segments, snapshots, campaigns, drafts, outbound sends, enrichment (`tests/segments.test.ts`, `tests/segmentSnapshotWorkflow.test.ts`, `tests/campaigns.test.ts`, `tests/drafts.test.ts`, `tests/emailOutbound.test.ts`, `tests/enrichment.test.ts`) have been kept green while adding W0.v3/W1.v2/AN.v2 features.
  - PRD/roadmap sync:
    - `docs/workflow_2_sim_replies_prd.md` now explicitly states SIM is contract-defined only as of 2025-12-01 (Option 2).
    - `docs/GMT_system_plan_v0.4_roadmap.md` marks W0.v3, W1.v2, and AN.v2 as implemented.
    - `docs/gtm_system_workflows_versions_v_0.md` annotates W0.v3 and AN.v2 as implemented and W0.v4/W2 as planned.
  - Lint, build, and full `pnpm test` remain green after these documentation and sanity updates.
- To Do:
  - For future SIM work, add dedicated `sim:*` CLI commands and extended AN views to correlate SIM outputs vs reality, once W2 moves beyond Option 2.

**Implementation Notes (Session 8)**  
- Design vs Actual: Rather than introducing a separate end-to-end test harness, we relied on the existing, focused test suites (segments, snapshots, campaigns, drafts, outbound, enrichment, analytics) to validate the spine. SIM remains clearly stubbed at the service layer only, with documentation aligned across PRD and roadmap files.

---

## Session → Requirements Mapping (Delivered IDs)

This section links each session to the most relevant requirement IDs in `docs/Requirements_Index_v0.1.md`. It is intentionally approximate and focuses on the primary IDs advanced by each session.

- **Session 1 – Foundations (Jobs, SIM contracts, events)**  
  - Advances: early groundwork for `W2.1_sim_schema_and_linkage` and future `CORE.*` observability IDs (jobs/event scaffolding).

- **Session 2 – W0 spine check (segments, versions, send jobs)**  
  - Delivers/strengthens: `W0.1_spine_invariance` (segment → segment_members → campaign → drafts → email_outbound → email_events).

- **Session 3 – ICP & hypotheses schema**  
  - Delivers: `W1.1_icp_profiles_and_hypotheses`.

- **Session 4 – Coach split (W1.v2 helpers)**  
  - Extends: `W1.1_icp_profiles_and_hypotheses` and supports future W1.x IDs by making ICP/hypothesis first-class in coach flows.

- **Session 5 – W0.v3 enrichment entry**  
  - Aligns with: Stage D “Enrichment & Judge” in roadmap; prepares the ground for enrichment-related `W0.*` IDs to be added to `Requirements_Index_v0.1.md`.

- **Session 6 – AN.v1 baseline analytics**  
  - Delivers: `W0.7_pattern_breaker_analytics` and supports `CORE.4_draft_pattern_and_user_edit_flags` by aggregating metrics over `draft_pattern` and `user_edited`.

- **Session 7 – AN.v2 optimization loop**  
  - Extends: `W0.7_pattern_breaker_analytics` with optimization insights and lays groundwork for AN/E-stage `TECH.*` / `UI.*` IDs to be introduced.

- **Session 8 – Hardening & W2 Option 2 sanity**  
  - Confirms: Option 2 posture for `W2.*` IDs and keeps SIM safely in “contracts-only” mode while W0/W1/AN evolve.

## Next Steps for W2 (SIM, Beyond Option 2)

When we decide to move W2 beyond Option 2, the next logical steps are:

- Implement **W2.v0 "Skeptical Buyer Roast"**  
  - Add a thin SIM mode that reuses existing ICP + draft context to critique offers/drafts, writing structured results back to Supabase for AN.v2 correlation.

- Implement **W2.v1 persona simulation on 5-contact samples**  
  - Use existing enrichment fields (`company_research`, `ai_research_data`) and `segment_members` sampling to drive persona + inbox simulations, storing outputs in dedicated SIM tables or `jobs.result`.

- Extend **AN.v2 to compare SIM vs reality**  
  - Add fields to analytics views and helpers so we can compare SIM verdicts (fit scores, verdict) against real-world outcomes, refining SIM prompts/weights over time.
