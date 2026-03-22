# Outreach System – Roadmap v0.4 (W0.v3 / W1.v2 / AN.v2 Focus)

> Version: v0.4 (2025-11-30)

This roadmap focuses on a concrete execution path to:
- Workflow 0 **W0.v3** – enrichment entry point on finalized segments.  
- Workflow 1 **W1.v2** – full ICP profiles + hypotheses with split coach prompts.  
- Analytics **AN.v2** – prompt & pattern optimization loop.

**Implementation status (2025-12-01):**
- W0.v3 – implemented: finalized segments, segment-level enrichment service, and CLI `enrich:run` writing into `company_research` / `ai_research_data`.
- W1.v2 – implemented: `icp_profiles`/`icp_hypotheses`, coach helpers, and draft generation with ICP/prompt metadata.
- AN.v2 – implemented: baseline analytics views, pattern optimization helpers, and `analytics:*` CLI commands.

It assumes we:
- Keep **Workflow 2 (SIM)** on **Option 2** – define contracts and job model now,
  implement actual SIM behaviour later.
- Treat the existing roadmap docs as complementary layers:
  - `docs/GMT_system_plan.md` – original MVP architecture & staged plan.
  - `docs/GMT_system_plan_v0.2.md` – status-aware roadmap aligned to PRD v0.2.
  - `docs/GMT_system_plan_v0.3_roadmap.md` – stages A–F mapped to workflows.

This v0.4 roadmap adds a **near-term, execution-oriented layer** on top of the
above, optimized for reaching W0.v3, W1.v2, and AN.v2 with minimal rework.

---

## 1. Roadmap Docs & Versioning

- `docs/GMT_system_plan.md`  
  - Initial architecture and staged development (Stages 0.5–3).
  - Remains useful as the architectural baseline.

- `docs/GMT_system_plan_v0.2.md`  
  - Status-aware refinement of the original plan as of 2025-11-25.  
  - Introduces explicit workflows (W0, W1, W2) and ties them to current code.

- `docs/GMT_system_plan_v0.3_roadmap.md`  
  - Execution roadmap organized into **Stages A–F** spanning W0/W1/W2 and
    observability/productization.
  - Stages A–F are still the canonical **stage labels** for requirements and
    roadmap mapping (see `docs/Requirements_Index_v0.1.md`).

- `docs/GMT_system_plan_v0.4_roadmap.md` (this document)  
  - Near-term plan aimed specifically at **W0.v3**, **W1.v2**, and **AN.v2**.  
  - Assumes W2 is **contract-defined but not implemented** (Option 2).  
  - Reuses Stage labels A–F conceptually but focuses only on the subset of work
    needed for the three targets.

Versioning rule of thumb:
- When we change **overall stage definitions** or priorities, we add a new
  `GMT_system_plan_v0.x*.md` file.
- When we change **specific behaviour** within a stage or workflow, we update
  the PRD and Requirements docs and reference the relevant roadmap versions.

---

## 2. Near-Term Targets & Dependencies

**Targets**
- W0.v3 – Enrichment entry point on finalized segments:
  - `segment.version = 1` snapshot, `segment_members` materialized.
  - `enrich segment` action and enrichment jobs writing to company/employee
    research fields.
- W1.v2 – Full ICP profiles & hypotheses + prompt split:
  - First-class `icp_profiles` and `icp_hypotheses` entities.
  - Coach flow split into `GenerateIcpProfile`, `GenerateIcpHypothesis`,
    `GenerateEmailDrafts`, emitting `pattern_id` and `coach_prompt_id`.
- AN.v2 – Prompt & pattern optimization loop:
  - Event spine from `send_jobs` through `email_events` with links to
    `icp_profile`, `icp_hypothesis`, `pattern_id`, and `user_edited`.
  - Analytics views that compare performance by ICP/hypothesis/pattern over
    time and drive prompt/pattern evolution.

**Dependencies**
- W0.v3 depends on:
  - Stable W0.v1 spine: `segment → segment_members → drafts → send_jobs`.
  - An enrichment job model and target fields for research data.
- W1.v2 depends on:
  - `icp_profiles` and `icp_hypotheses` schema and basic flows.
  - AI contracts split into ICP/hypothesis/draft generation calls.
- AN.v2 depends on:
  - Event schema and logging (AN.v1).
  - Stable identifiers: `segment_id`, `segment_version`, `icp_profile_id`,
    `icp_hypothesis_id`, `pattern_id`, `coach_prompt_id`, `user_edited`.

SIM (W2) in this phase:
- SIM request/response types and job types are designed now.
- W2 behaviour (offer roast, persona SIM, reply assist) is **not yet
  implemented**; jobs complete with “not implemented” or “feature off” status.

---

## 3. Phase 0 – Shared Foundations (Jobs, SIM Contracts, Events)

**Goal:** Create shared primitives used by W0, W1, AN, and future W2.

**3.1 Jobs model**
- Introduce a generic `jobs` concept with at least:
  - `id`, `type` (`enrich`, `sim`, `send`), `status`
    (`created`, `running`, `completed`, `failed`),
  - `payload` (JSON), `result` (JSON),
  - references to `segment_id`, `segment_version` (optional),
  - timestamps.
- W0, W1, W2, and integrations reuse this model for long-running work.

**3.2 SIM contracts (Option 2)**
- Define **stable types** now, without implementing behaviour:
  - `SimMode`: `light_roast`, `persona_sim`, `reply_assist`.
  - `SimRequest`: mode, segment/sample context, ICP references, draft IDs,
    options.
  - `SimResult`: job id, status, and placeholders for per-contact outputs and
    aggregate verdicts.
- Implementation in this phase:
  - Accept SIM requests, create `jobs` rows with `type = 'sim'`.
  - Immediately mark them as `failed_not_implemented` or
    `skipped_feature_flag_off` with a clear reason.

**3.3 Event logging scaffolding**
- Establish minimal `email_events` (or equivalent) schema:
  - `event_type` (`sent`, `delivered`, `opened`, `replied`, `positive_reply`),
    timestamps.
  - Foreign keys to `draft_id`, `send_job_id`, `segment_id`, `segment_version`,
    `employee_id`.
  - Optional references to `icp_profile_id`, `icp_hypothesis_id`, `pattern_id`,
    `coach_prompt_id`.
- Ensure CLI/web send and ingest flows **always** emit these events, even if
  the analytics layer (AN) is still minimal.

---

## 4. Phase 1 – W0.v1 Spine: Segments, Members, Drafts, Send Jobs

**Goal:** Make the audience → drafts → send path explicit and traceable.

**4.1 Segments & versions**
- Implement `segments` with:
  - Filter definition (JSON or structured fields).
  - `version` field:
    - `version = 0` – raw, editable filters.
    - `version ≥ 1` – finalized snapshots.
- Provide flows (CLI + web) to:
  - Create/edit a `version = 0` segment.
  - Confirm the audience to create `version = 1` (final snapshot).

**4.2 Segment members & drafts**
- `segment_members`:
  - Materialized only for finalized versions (v1+).
  - Fields: `segment_id`, `segment_version`, `employee_id`, `inclusion_reason`.
- Drafts per member:
  - For each `segment_member`, attach `draft_email_1` (intro),
    `draft_email_2` (bump), `pattern_id`, `generator`, `user_edited`.
  - Use Appendix A contract (`generate_email_draft`) and record
    `coach_prompt_id` / `pattern_mode` / `draft_pattern`.

**4.3 Send jobs**
- Implement send jobs using the generic `jobs` model:
  - Either `jobs.type = 'send'` with send-specific payload/result, or a
    dedicated `send_jobs` table that references `jobs`.
  - Fields: provider (Smartlead/SMTP), scope (all vs selected leads),
    lifecycle status.
- Ensure outbound emails always reference:
  - `segment_id`, `segment_version`, `segment_member` (or `draft_id`),
    `send_job_id`.

Outcome:
- For any email, you can answer **who**, **which segment version**, **which
  pattern/prompt**, and whether the user edited it.

---

## 5. Phase 2 – ICP & Hypothesis Core Model

**Goal:** Make ICP and hypotheses first-class and link them to segments.

**5.1 Schema**
- Add `icp_profiles`:
  - Fields like industry, company type, size, region, decision-makers,
    influencers, pains, triggers.
- Add `icp_hypotheses`:
  - Linked `icp_profile_id`.
  - Fields for offer/angle being tested, desired outcome (reply/call/demo),
    funnel position (cold vs warm), notes.
- Link `segments` to ICP:
  - `segment.icp_profile_id`, `segment.icp_hypothesis_id` (optional initially).

**5.2 Minimal flows**
- CLI and/or web flows to:
  - Create/edit ICP profiles.
  - Create/edit hypotheses and attach them to segments.

**5.3 AI contract alignment**
- Update AI contracts (Appendix A and code) so that:
  - `GenerateIcpProfile` produces `icp_profile` objects.
  - `GenerateIcpHypothesis` produces `icp_hypothesis` objects tied to a
    profile.
  - `GenerateEmailDrafts` takes ICP + hypothesis IDs/objects as inputs.

Outcome:
- ICP and hypotheses are reusable entities, not only prompt text, and are
  consistently tied to segments and drafts.

---

## 6. Phase 3 – W1.v2: Full ICP Profiles & Coach Prompt Split

**Goal:** Refactor the email coach into explicit ICP/hypothesis/draft steps.

**6.1 Coach flow structure**
- Step 0 – ICP formation:
  - Dedicated coaching flow to collect and refine `icp_profile` data.
  - Store in `icp_profiles` and allow reuse across segments.
- Step 1 – Hypothesis formation:
  - Given an `icp_profile`, form an `icp_hypothesis` for a specific segment:
    what is being tested, expected outcome, funnel position.
- Step 2 – Draft generation:
  - For each employee:
    - Inputs: `icp_profile`, `icp_hypothesis`, role, enrichment data (if any),
      communication preferences, pattern/mode.
    - Outputs: intro + bump drafts with `pattern_id`, `coach_prompt_id`,
      `email_type`.

**6.2 Refactoring the monolithic coach**
- Replace the single large prompt with:
  - Separate prompts/calls for ICP profiles, hypotheses, and email drafts.
  - Preserve current UX where possible (e.g., still feel like “one flow” to the
    user).
- Persist and expose:
  - ICP/hypothesis objects for later analytics and reuse.
  - `coach_prompt_id` and `pattern_id` for drafts.

Outcome:
- W1.v2 behaviour from `docs/gtm_system_workflows_versions_v_0.md` is supported
  end-to-end, and ICP/hypothesis information is available to both W0 (for
  drafting) and AN (for analytics).

---

## 7. Phase 4 – W0.v3: Enrichment Entry Point

**Goal:** Trigger enrichment on finalized segments and feed results into drafts.

**7.1 Enrichment targets**
- Company-level:
  - Either add JSON field `companies.company_research` or a dedicated
    `company_research` table.
- Employee-level:
  - Either add JSON field `employees.ai_research_data` or a dedicated
    `employee_research` table.

**7.2 Enrichment jobs**
- Use `jobs` with `type = 'enrich'`:
  - Payload: `segment_id`, `segment_version`, lists of company/employee IDs,
    configured providers (EXA, Parallel, Firecrawl), estimated cost.
  - Result: references to research entries, status per provider, summary
    metrics.
- Enrichment behaviour:
  - Only allowed for `segment.version = 1` (final audience).
  - Does **not** change segment membership; only enriches data.

**7.3 UX and caching**
- UX/CLI:
  - “Enrich segment” action on finalized segments.
  - Simple status view per segment: last job, status, number of enriched
    entities, last updated.
- Caching:
  - For each company/employee, track `last_enriched_at` and provider metadata.
  - Respect TTLs and allow manual invalidation when data is stale.

Outcome:
- W0.v3 is implemented: enrichment is a first-class step after audience
  finalization and before deeper draft review or SIM.

---

## 8. Phase 5 – AN.v1: Baseline Analytics

**Goal:** Build the minimal analytics layer needed before optimization.

**8.1 Email events & edits**
- `email_events`:
  - Ensure each event includes foreign keys to key entities:
    `draft_id`, `send_job_id`, `segment_id`, `segment_version`, `employee_id`.
  - Where available, also store `icp_profile_id`, `icp_hypothesis_id`,
    `pattern_id`, `coach_prompt_id`.
- User edits:
  - Track `user_edited` per draft and/or log explicit `user_edit` events.

**8.2 Baseline views**
- Provide simple analytics views (SQL or UI) for:
  - Performance by ICP profile/hypothesis.
  - Performance by segment and role.
  - Performance by pattern/mode.
  - AI-only vs user-edited drafts.

Outcome:
- The system can answer basic “what works” questions by ICP/hypothesis/segment/
  role/pattern using real-world data.

---

## 9. Phase 6 – AN.v2: Prompt & Pattern Optimization Loop

**Goal:** Use analytics to iteratively improve prompts, patterns, and ICP
assumptions.

**9.1 Prompt & pattern versioning**
- Maintain a prompt registry:
  - `coach_prompt_id` as a semantic/versioned identifier.
  - Metadata: description, version, rollout status.
- Maintain pattern metadata:
  - Stable `pattern_id` derived from prompt pack, Pattern Breaker mode, and
    variant.

**9.2 Optimization analytics**
- Build views to:
  - Compare ICP hypotheses and patterns over time (reply/positive reply rates,
    edit rates, unsubscribe/negative signals).
  - Identify underperforming combinations to retire/deprioritize.
  - Highlight promising combinations to scale or clone.

**9.3 SIM readiness**
- Without implementing SIM yet, make AN.v2 **SIM-ready** by:
  - Reserving columns/fields for SIM outputs (fit scores, verdicts) in
    analytics tables or materialized views.
  - Logging SIM job metadata (from `jobs` with `type = 'sim'`) even if results
    are “not implemented”.
  - Ensuring queries treat SIM data as optional so that adding real SIM later
    is non-breaking.

Outcome:
- You can make data-informed decisions about prompts, patterns, and hypotheses,
  and you are ready to plug in real SIM outputs when W2 is prioritized.

---

## 10. How This Aligns with Stages & Requirements IDs

- Stages A–F in `docs/GMT_system_plan_v0.3_roadmap.md` remain the **canonical
  stage labels**:
  - Stage A – Spine & parity (overlaps Phases 0–1 here).
  - Stage B – Workflow 0 (overlaps Phases 1 and 4 here).
  - Stage C – Workflow 1 (overlaps Phases 2–3 here).
  - Stage E – Analytics & optimization (overlaps Phases 5–6 here).
  - Stage D (SIM) and Stage F (productization) are **out of scope** for this
    v0.4 near-term plan.
- `docs/Requirements_Index_v0.1.md` remains the source of truth for:
  - IDs like `W0.4_base_email_editing`, `W1.1_icp_profiles_and_hypotheses`,
    `W2.1_sim_schema_and_linkage`, etc.
  - Mapping from roadmap stages to these IDs.

When updating behaviour:
- Update the PRD (`docs/AI_SDR_GTM_PRD*.md`) and appendix contract first.
- Ensure relevant IDs in `docs/Requirements_Index_v0.1.md` reflect the change.
- Reference this v0.4 roadmap when planning work that specifically advances
  W0.v3, W1.v2, or AN.v2.
