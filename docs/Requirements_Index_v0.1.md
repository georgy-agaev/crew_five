# Requirements Index – Current State

> Version: v0.1 (2025-11-27)  
> See also: `docs/Requirements_ID_Scheme.md`

This index lists the initial set of requirement IDs mapped to the current PRD, AI contract appendix, and roadmap. It is intentionally lightweight and will be expanded/refined over time.

---

## 1. PRD v0.2 Workflows (`docs/AI_SDR_GTM_PRD_v0.2_workflows.md`)

### Workflow 0 – Client Selection & First-Email Sequence

- **W0.1_spine_invariance**  
  - The canonical spine `segment → segment_members → campaign → drafts → email_outbound → email_events` must remain the backbone for all Workflow 0 steps.
- **W0.2_audience_selection_flow**  
  - Audience selection UI/CLI over `companies` with filters, guardrails (max cohort size), and persisted selection filters/snapshots.
- **W0.3_contacts_review_inclusion_flags**  
  - Contacts review screen and backend logic to join `companies` ↔ `employees`, compute counts, and store inclusion flags per contact/company (preferably via `segment_members`).
- **W0.4_base_email_editing**  
  - Capture LLM-original and user-edited versions of the base email template, with support for diffs/metadata, and store them in a way that can be reused for bulk personalization.
- **W0.5_bulk_personalization**  
  - Generate per-contact drafts from the base email (plus optional micro-personalization), persisting them as `drafts` with status `generated` and any warnings.
- **W0.6_draft_status_flags**  
  - Extend `drafts.status` to represent lifecycle states such as `generated`, `edited_by_user`, `regenerated`, `excluded`, and use these consistently in Workflow 0 flows.
- **W0.7_pattern_breaker_analytics**  
  - Log Pattern Breaker usage per draft by combining `coach_prompt_id`, `pattern_mode`, and variant into a stable pattern id; use it later for performance analysis.

### Workflow 1 – ICP Discovery & Prospect Expansion

- **W1.1_icp_profiles_and_hypotheses**  
  - Schema and CLI for `icp_profiles` and `icp_hypotheses` to store structured ICP descriptions and hypotheses.
- **W1.2_icp_discovery_via_exa**  
  - ICP-driven discovery workflow that queries EXA via MCP, collects candidate companies/contacts, and normalizes them into transient structures.
- **W1.3_icp_to_supabase_writeback**  
  - Review/approval flow that upserts discovered companies/employees into Supabase with ICP tags and provenance.

### Workflow 2 – Prospect Reaction Simulation (SIM)

- **W2.1_sim_schema_and_linkage**  
  - Schema for `sim_runs` / `sim_results` linked to campaigns/drafts/ICP profiles.
- **W2.2_offer_roast_mvp**  
  - A minimal “offer roast” SIM mode that critiques drafts and returns structured feedback.
- **W2.3_full_persona_simulation**  
  - Multi-persona SIM loop with persona enrichment, inbox simulation, and aggregated insights/objections written back to Supabase.

---

## 2. Appendix A – AI Contract (`docs/appendix_ai_contract.md`)

- **CORE.1_generate_email_draft_contract**  
  - Stable TypeScript-level contract for `generate_email_draft(email_type, language, pattern_mode, brief)` including `EmailDraftRequest` and `EmailDraftResponse`.
- **CORE.2_ai_response_shape**  
  - Response shape invariants: `subject`, `body`, and `metadata` fields (`model`, `language`, `pattern_mode`, `email_type`, `coach_prompt_id`, optional `quality_score`).
- **CORE.3_pattern_breaker_fields**  
  - `metadata.pattern_mode` and `metadata.coach_prompt_id` must be emitted for every draft to support Pattern Breaker analytics.
- **CORE.4_draft_pattern_and_user_edit_flags**  
  - Application code must persist a stable `draft_pattern` (derived from `coach_prompt_id`, `pattern_mode`, and variant) and a `user_edited` boolean per draft for later analysis of AI-only vs user-edited messages.

---

## 3. Integrations – Smartlead & Others

- **INT.1_smartlead_api_client**  
  - Direct Smartlead HTTP API client that supports listing campaigns, adding leads to a campaign, and saving campaign sequences, configured via `SMARTLEAD_API_BASE` / `SMARTLEAD_API_KEY`.
- **INT.2_smartlead_direct_cli_commands**  
  - CLI commands `smartlead:campaigns:list`, `smartlead:leads:push`, and `smartlead:sequences:sync` wired to the Smartlead API client with `--dry-run` support and Supabase-backed mapping.
- **INT.3_smartlead_event_ingest_mcp_or_webhooks**  
  - Smartlead event ingestion via MCP (`smartlead:events:pull` + `event:ingest`) or webhooks, normalizing into `email_events` while maintaining idempotency on `provider_event_id`.
- **INT.4_smtp_send_adapter**  
  - SMTP adapter used by `email:send` that pulls queued drafts from Supabase, sends emails with throttling, logs into `email_outbound`, and updates `drafts.status`.

---

## 4. Roadmap Stages – High-Level Mapping (`docs/GMT_system_plan_v0.3_roadmap.md`, `docs/GMT_system_plan_v0.4_roadmap.md`)

- **Stage A – Stabilize Core Spine & Parity**
  - Primarily covers `CORE.1–CORE.3`, `INT.3`, `INT.4`, and the enforcement side of `W0.1_spine_invariance`.
- **Stage B – Workflow 0 (Client Selection & Sequence)**
  - Delivers most of `W0.1–W0.7`, plus UI/CLI parity for these flows.
- **Stage C – Workflow 1 (ICP Discovery & Prospect Expansion)**
  - Focuses on `W1.1–W1.3` and related `INT.*` entries for Exa/AnySite integrations.
- **Stage D – Workflow 2 (SIM)**
  - Maps to `W2.1–W2.3` and any future `SIM.*` IDs we define.
- **Stage E/F – Observability, Optimization, Productization**
  - Will introduce additional `CORE.*`, `UI.*`, and `TECH.*` IDs as we formalize metrics, dashboards, and multi-operator workflows.

---

## 5. Notes

- This file reflects the current, incomplete mapping between requirements and IDs as of 2025-11-27. It is expected to evolve.
- When adding new behaviour to the PRD, appendix, or roadmap, prefer reusing existing IDs where appropriate or adding new IDs here and in `docs/Requirements_ID_Scheme.md`.

---

## 6. Delivery by Sessions (v0.4 Snapshot)

This section links the initial set of working sessions in `docs/sessions/2025-11-30_1_w0v3-w1v2-anv2_session-plans.md` to the IDs they primarily advanced.

- **Session 1 – Foundations (jobs, SIM contracts, events)**  
  - Groundwork for: `W2.1_sim_schema_and_linkage`, future `CORE.*` observability IDs.

- **Session 2 – W0 spine check**  
  - Delivers/strengthens: `W0.1_spine_invariance`.

- **Session 3–4 – ICP schema & coach split (W1.v2)**  
  - Delivers: `W1.1_icp_profiles_and_hypotheses`.

- **Session 5 – W0.v3 enrichment entry**  
  - Aligns with roadmap Stage D (“Enrichment & Judge”); corresponding `W0.*` IDs to be added in a future revision of this Index.

- **Session 6–7 – AN.v1/AN.v2 analytics & optimization**  
  - Delivers/extends: `W0.7_pattern_breaker_analytics`, `CORE.4_draft_pattern_and_user_edit_flags`.

- **Session 8 – Hardening & W2 Option 2 sanity**  
  - Confirms Option 2 posture for `W2.*` (SIM) IDs without implementing SIM execution.
