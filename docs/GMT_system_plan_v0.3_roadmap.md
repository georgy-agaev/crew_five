# Outreach System – Revised Roadmap v0.3 (Aligned to PRD v0.2)

This roadmap updates `docs/GMT_system_plan.md` in light of:
- The current implementation (CLI spine, Smartlead MCP, enrichment/judge stubs,
  web scaffold, tracing/telemetry).
- The extended workflows in `docs/AI_SDR_GTM_PRD_v0.2_workflows.md`:
  - Workflow 0 – Client selection & first-email sequence.
  - Workflow 1 – ICP discovery & prospect expansion (Exa + AnySite).
  - Workflow 2 – Prospect reaction simulation (SIM).

Existing files remain the source of truth for earlier plans; this document adds
an execution-oriented roadmap going forward.

---

## 1. Stage Overview

The roadmap is organized into six pragmatic stages:

1. **Stage A – Stabilize Core Spine & Parity**  
   Finish and harden the existing CLI + web flows on the current Supabase spine.
2. **Stage B – Workflow 0 (Client Selection & Sequence)**  
   Implement the end-to-end selection → base email → bump sequence flow.
3. **Stage C – Workflow 1 (ICP Discovery & Prospect Expansion)**  
   Add ICP/hypothesis storage and Exa/AnySite-powered prospect discovery.
4. **Stage D – Workflow 2 (SIM – Prospect Reaction Simulation)**  
   Build SIM, starting with offer roast and then full persona-based simulation.
5. **Stage E – Observability & Optimization**  
   Deliver trace explorer, analytics, and pattern/ICP-level optimization tools.
6. **Stage F – Automation & Productization**  
   Wrap flows into repeatable playbooks and polish for multi-operator use.

Stages overlap slightly; each stage lists dependencies and acceptance criteria.

---

## 2. Stage A – Stabilize Core Spine & Parity

**Goal:** Get the existing system (CLI + web + Smartlead + tracing) into a
stable “operations-ready” state before layering on new flows.

**Key workstreams**
- **A1. Web adapter hardening**
  - Wire `src/web/server.ts` to Supabase and SMTP in non-mock mode with:
    - Explicit env toggles (`mock` vs `live`).
    - Clear error messages and recovery hints (invalid env, missing keys,
      provider errors).
  - Ensure web flows mirror CLI behavior for:
    - Campaign listing/creation.
    - Draft generation (Strict vs Graceful, Coach vs Express).
    - Send gating (disabled when provider not ready).

- **A2. Reply ingest & event spine**
  - Implement IMAP or webhook-based reply ingestion such that:
    - Replies and bounces land in `email_events`.
    - `employees.reply_*` flags and any `employees.reply_*` / `client_status`
      fields update consistently.
  - Align Smartlead events (`smartlead:events:pull` / `event:ingest`) with the
    same `email_events` contract.

- **A3. CLI guardrails & ast-grep compliance**
  - Keep `src/cli.ts` and `src/commands/**` in sync with `ast-grep.yml` rules:
    - `--dry-run` on mutating commands.
    - Retry caps, `--assume-now-occurred-at`, idempotency semantics.
  - Add tests for any uncovered branches highlighted in coverage
    (especially `cli.ts`, `emailOutbound.ts`, segment services).

**Dependencies**
- Existing spine tables and CLI commands (already in place).

**Acceptance criteria**
- CLI and web can:
  - Create campaigns → generate drafts → send via SMTP/Smartlead in live mode.
  - Ingest replies/bounces and update the spine correctly.
- `pnpm test` (including coverage) stays green; ast-grep passes with zero
  errors on guarded rules.

---

## 3. Stage B – Workflow 0: Client Selection & First-Email Sequence

**Goal:** Implement the full Workflow 0 loop from PRD v0.2 using existing data
and AI contract.

**Key workstreams**
- **B1. Audience selection UI + backing schema**
  - Add an “Audience Selection” screen in web:
    - Filters on `companies`: `created_at`, `updated_at`, `registration_date`,
      `segment`, `office_*` field, and inferred `last_outreach` proxy.
  - Backend:
    - Reuse `segments` and `segment_members` for saved selections.
    - Persist selection filters (JSON) against segments or a dedicated
      `selection_session` entity.

- **B2. Contacts review & inclusion flags**
  - UI: “Contacts Review” step listing employees for selected companies with:
    - Email type badges (`work`, `generic`, `none`).
    - Inclusion toggles per contact and per company.
  - Backend:
    - Store inclusion flags either on `segment_members` or a lightweight
      `campaign_contacts` table.

- **B3. Coach-led offer & ICP capture**
  - Implement a coach-like flow (initially CLI, then UI) to capture:
    - `offer_summary`, `icp_summary`, `email_tone`, `cta`.
  - Persist this metadata on `campaigns` or `campaign_meta` and feed it into
    `generate_email_draft`.

- **B4. Base email editing & bulk personalization**
  - Extend draft generation to:
    - Track a base “anchor” email (LLM original + user-edited).
    - Generate per-contact drafts for the cohort with status flags:
      `generated`, `edited_by_user`, `regenerated`, `excluded`.
  - UI:
    - Table view of generated drafts with status filters.
    - Per-draft editor + single-contact regenerate.

- **B5. Bump step & sequence modeling**
  - Model bump emails as second steps in the same spine:
    - Step metadata: `email_type = bump`, `send_offset_days`, conditions.
  - UI flow for:
    - Configuring bump delay/conditions.
    - Editing bump template.
  - CLI parity: flags for sequence configuration when creating/updating
    campaigns.

**Dependencies**
- Stage A hardened spine and parity.
- Appendix A `generate_email_draft` contract.

**Acceptance criteria**
- From web or CLI, a user can:
  - Select an audience → review contacts → define offer/ICP →
    approve a base email → generate/curate per-contact drafts →
    define a bump → schedule sending.
- All emails (initial + bump) still traverse
  `segment → segment_members → campaign → drafts → email_outbound → email_events`.

---

## 4. Stage C – Workflow 1: ICP Discovery & Prospect Expansion

**Goal:** Implement the ICP → Exa/AnySite → Supabase loop with strong
review/approval points.

**Key workstreams**
- **C1. ICP & hypothesis schema + CLI**
  - Add `icp_profiles` and `icp_hypotheses` tables (per v0.2 PRD).
  - CLI commands:
    - `icp:create`, `icp:list`, `icp:update`.
    - `icp:hypothesis:create`, `icp:hypothesis:list`.
  - Use Interactive Coach mode to populate structured ICP objects.

- **C2. Exa MCP integration (minimal surface)**
  - Configure `exa-mcp-server` with a single high-value tool
    (`exa_websets_search`).
  - Implement an `icp:discover` CLI command that:
    - Builds Websets queries from ICP/hypotheses.
    - Calls Exa via MCP.
    - Normalizes candidate companies/contacts into transient structures.

- **C3. Pre-import review & Supabase write-back**
  - UI for reviewing candidates:
    - Filter by confidence, country, industry, size.
  - On approval:
    - Upsert `companies` and `employees` with `source`, `icp_id`,
      `hypothesis_id`, `confidence_score`, `exa_metadata`.

- **C4. AnySite enrichment integration**
  - Use AnySite (or equivalent) to:
    - Attach `linkedin_profile_url`, `linkedin_headline`, `social_metadata` to
      employees.
  - Integrate with existing email enrichment/validation where present.

- **C5. Hand-off to segments/campaigns**
  - Provide:
    - CLI helpers (e.g. `icp:segment:create`) to auto-create segments from ICP
      runs.
    - UI entry points for “Create campaign from ICP run”.

**Dependencies**
- Stages A and B.
- Exa MCP and AnySite credentials/configured endpoints.

**Acceptance criteria**
- Operator can run an ICP session, discover similar companies/contacts, review
  them, enrich them, and land them into Supabase with ICP tags—then create a
  campaign off that data using existing flows.

---

## 5. Stage D – Workflow 2: SIM (Prospect Reaction Simulation)

**Goal:** Help users de-risk messaging before scale using LLM-based persona
simulation grounded in real profiles.

**Key workstreams**
- **D1. SIM schema & linkages**
  - Add `sim_runs` and `sim_results` tables as described in v0.2 PRD:
    - Link to `campaigns` or `drafts`, `icp_id`, and `seed` employees.

- **D2. Super-light “offer roast”**
  - CLI + UI flow:
    - Select draft (or paste email).
    - Run a “Skeptical Buyer” roast that outputs:
      - Clarity/differentiation assessment.
      - Credibility concerns.
      - Suggestions for proof and framing.
  - Cheap, single-call path with structured JSON results.

- **D3. Full SIM**
  - Allow user to:
    - Pick an ICP/segment and 5–10 seed contacts.
    - Run full SIM:
      - Persona enrichment via existing data + AnySite.
      - Inbox simulation per persona.
      - Aggregated pain/KPI alignment, objections, and recommendations.
  - Store outputs in `sim_results` and attach summaries back to drafts/campaigns.

- **D4. Feedback loop**
  - Track relationship between SIM predictions and real campaign outcomes:
    - Compare predicted vs actual reply/meeting rates for campaigns with SIM
      runs.
  - Use this for internal calibration, not direct automation initially.

**Dependencies**
- Stages A–C.
- AnySite or equivalent enrichment with LinkedIn context.

**Acceptance criteria**
- Users can run SIM (offer roast or full) on a draft tied to a segment or ICP
  and receive:
  - Clear, structured recommendations.
  - Stored SIM artifacts that can be revisited and compared against real
    performance.

---

## 6. Stage E – Observability & Optimization

**Goal:** Make the system explainable and tunable across ICPs, prompts,
providers, and SIM/experiments.

**Key workstreams**
- **E1. Trace explorer UI**
  - Web UI for:
    - Viewing traces (`api_traces`, `ai_interactions`) per campaign/contact.
    - Filtering by provider, latency, error codes.
    - Exporting traces for debugging.

- **E2. Pattern & ICP analytics**
  - Dashboards/tables for:
    - Pattern Breaker variants and reply/meeting/angry rates.
    - ICP/hypothesis performance: meetings/bookings per ICP and per discovery
      channel (manual vs Exa).
    - SIM vs reality comparison.

- **E3. Optimization hooks**
  - Lightweight mechanisms to:
    - Mark underperforming patterns/ICPs as “retire” or “deprioritize”.
    - Suggest next experiments (e.g. new pattern prompts or ICP variants).

**Dependencies**
- Tracing/telemetry already wired (Stage A).
- ICP, SIM, and experiments data in place (Stages C, D).

**Acceptance criteria**
- Operators can answer:
  - “Which ICP + pattern + provider combination is performing best?”
  - “Why did this campaign behave this way?” via trace explorer.

---

## 7. Stage F – Automation & Productization

**Goal:** Turn the workflows into repeatable playbooks and a maintainable
product for teams.

**Key workstreams**
- **F1. Playbooks & templates**
  - Predefined templates for:
    - “Launch first campaign from CSV.”
    - “Discover similar customers for a new ICP.”
    - “Run SIM before scaling a new pattern.”

- **F2. Permissions and workspace hygiene**
  - Add basic roles (operator vs viewer).
  - Safe default RLS policies for multi-operator single-tenant deployments.

- **F3. Documentation & onboarding**
  - Keep PRD, roadmap, and database docs aligned with final schema and flows.
  - Provide guided tours in UI for key workflows (0, 1, and 2).

**Dependencies**
- All prior stages to be at least minimally complete.

**Acceptance criteria**
- A new GTM engineer can, with docs and UI affordances, run:
  - An end-to-end campaign from ingestion to SIM-informed optimization.
  - ICP discovery and new-customer expansion with predictable steps and
    safeguards.

