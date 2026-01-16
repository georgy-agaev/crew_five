# Outreach System – Roadmap v0.2 (Status + New Flows)

This document refines `docs/GMT_system_plan.md` with:
- Current implementation status (as of 2025‑11‑25).
- Updated stages that incorporate:
  - Client selection + sequence workflow (Workflow 0).
  - ICP discovery & prospect expansion (Workflow 1).
  - Prospect reaction simulation (SIM, Workflow 2).

It does not replace the original plan; it is a status-aware roadmap layer.

---

## 1. Snapshot of Current Status

Based on code, tests, and the changelog:

- **Spine & core tables**: Implemented (`segments`, `segment_members`,
  `campaigns`, `drafts`, `email_outbound`, `email_events`, `fallback_templates`).
- **CLI**:
  - Segment lifecycle: `segment:create`, `segment:snapshot`, filter validation.
  - Campaign lifecycle: `campaign:create`, `campaign:update`, `campaign:status`.
  - Draft generation: `draft:generate` with dry‑run, fail‑fast, limits.
  - Send scaffold: `email:send` with throttling, dry‑run, batch summaries.
  - Event ingest: `event:ingest` plus Smartlead MCP `smartlead:events:pull`.
  - Enrichment stub: `enrich:run`.
  - Judge scaffold: `judge:drafts`.
- **Smartlead MCP**:
  - Ingest and send flows with retry caps, assume‑now, idempotency, telemetry,
    and reply pattern tagging.
- **Web layer**:
  - Backend adapter (`src/web/server.ts`) with tests.
  - Frontend scaffold (`web/`) with API client, core pages (Campaigns, Drafts,
    Send, Events/Patterns, Settings) and tests.
  - Adapter currently focused on mock/dev wiring; live Supabase/SMTP wiring is
    emerging.
- **Telemetry & tracing**:
  - Tracing service for AI drafts and Smartlead MCP calls.
  - Telemetry helper + CLI flags for PII‑safe logging.
- **Enrichment & judge**:
  - Graceful fallback templates and adapter registry.
  - Judge stub and CLI coverage.

Not yet implemented (spec‑only):
- ICP & hypothesis storage and Exa/AnySite integration.
- SIM (prospect reaction simulation) flows.
- Full trace explorer UI and analytics rollups.

---

## 2. Updated Stages

### Stage 0.5 – Foundations (Complete)

**Status:** ✅ Complete

- Finalized spine tables and core `employees` fields (`outreach_status`,
  `last_outreach_at`).
- Added `email_outbound` and `email_events`.
- Linked Supabase project and first migrations.
- Stood up Node/TS CLI scaffold and basic segment/campaign/draft flows.

---

### Stage 1 – Outreach MVP (Mostly Complete)

**Status:** ✅/🟡 Mostly complete

- Contacts → segments → campaigns → drafts → send:
  - CLI flows and tests in place.
  - Smartlead/SMTP abstraction scaffolded.
- Minimal Web UI:
  - Campaigns/Drafts/Send/Events/Settings pages and API client implemented with
    mock adapters.
- Logging:
  - Outbound logging and basic event ingest.

**Remaining for “Stage 1: Done”**
- Wire web adapter fully to Supabase + SMTP in a non‑mock mode, behind a clear
  env toggle.
- Ensure IMAP reply ingestion or an equivalent reply‑logging mechanism reaches
  `email_events`.

---

### Stage 1.5 – CLI & Web Parity + Smartlead (In Progress)

**Status:** 🟡 In progress

- CLI parity:
  - CLI covers segment/campaign/draft/send/event flows with guardrails and
    dry‑run/telemetry options.
- Web parity:
  - Web surfaces interaction/data‑quality modes, send gating, and adapter mode
    badges.
- Smartlead MCP:
  - Ingest‑first integration completed; outbound send and reply patterns wired
    with telemetry and idempotency.

**Next**
- Harden adapter behavior in both CLI and web for:
  - Live Smartlead vs stub modes.
  - Error surfacing and recovery guidance.

---

### Stage 2 – Enrichment & Judge (Partial)

**Status:** 🟡 Partial

Implemented:
- Enrichment registry and stub adapter.
- Graceful fallback templates and service.
- Judge scaffold and `judge:drafts` CLI with dry‑run/limit options.

Missing for full Stage 2:
- Exa/Parallel/AnySite integration for:
  - `company_insights` and `employee_insights` tables.
  - Persistent insight payloads that feed draft generation.
- LLM‑as‑a‑Judge wired through AI SDK to log into `ai_interactions` and
  `api_traces`.
- UI surfaces for insights and quality scores.

---

### Stage 2.5 – ICP Discovery & Prospect Expansion (New)

**Status:** 🔵 Planned

Scope (from `docs/1_icp_discovery_exa_any_site_workflow.md` and v0.2 PRD):
- ICP definition sessions with structured ICP and hypothesis objects.
- Exa MCP integration:
  - Websets search based on ICPs/hypotheses.
  - Candidate accounts and contacts extraction with confidence scores.
- AnySite integration:
  - LinkedIn URL and headline enrichment.
  - Optional social context for personalization and content themes.
- Supabase extensions:
  - `icp_profiles`, `icp_hypotheses`.
  - `source`, `icp_id`, `hypothesis_id`, `confidence_score` on companies and
    employees.
- Pre‑import review UI and CLI flows for ICP‑sourced leads.

Milestones:
1. Schema and CLI for ICP and hypotheses (no Exa).
2. Exa MCP wired with hard caps and pre‑import review.
3. AnySite enrichment and write‑back to `employees`.
4. ICP‑tagged segments and campaigns via existing segmentation engine.

---

### Stage 3 – Trace Logging & Optimization (Partial)

**Status:** 🟡 Partial

Implemented:
- Tracing service and telemetry hooks for AI drafts and Smartlead MCP calls.
- CLI flags for telemetry and safe logging.

Missing:
- Trace explorer UI in web app:
  - Per‑campaign and per‑contact trace timelines.
  - Provider latency and cost breakdown.
- Analytics rollups:
  - Per‑pattern, per‑persona, per‑ICP performance.
  - Integration with experiments/judge results.

---

### Stage 3.5 – Prospect Reaction Simulation (SIM) (New)

**Status:** 🔵 Planned

Scope (from `docs/2_sim_prospect_reaction_simulation_workflow.md` and v0.2 PRD):
- SIM modes:
  - Full persona‑based prospect reaction simulation.
  - Super‑light “Skeptical Buyer roast” mode for fast offer checks.
- Inputs:
  - ICP/segment, value proposition, assumptions.
  - Seed contacts (real LinkedIn profiles or enriched employees).
  - Draft email (subject/body/CTA from `drafts` or pasted).
- Outputs:
  - Per‑persona emotional and business reactions.
  - Aggregated pain/KPI alignment scores.
  - Objections and risk flags.
  - Concrete copy and positioning recommendations.
- Data model:
  - `sim_runs` and `sim_results` linked to campaigns/drafts/ICPs.

Milestones:
1. Offer‑roast mode (no persona enrichment, cheap).
2. Full SIM for a small set of seed contacts using existing enrichment data.
3. UI surfaces for SIM reports and “apply recommendations” loops.
4. Analytics that compare SIM predictions to real campaign outcomes.

---

## 3. Recommended Near‑Term Sequence

To keep risk manageable while adding value:

1. **Finish Stage 1 + 1.5 hardening**
   - Wire live web adapter to Supabase/SMTP with safe defaults.
   - Close gaps on IMAP/reply ingestion and event logging.
2. **Deepen Stage 2 (Enrichment & Judge)**
   - Introduce `company_insights` / `employee_insights`.
   - Integrate EXA/AnySite for limited, capped enrichment flows.
   - Surface judge scores and insights in UI.
3. **Implement Stage 2.5 (ICP Discovery)**
   - Build ICP CLI/UI and Exa MCP integration.
   - Add pre‑import review and ICP‑tagged segments.
4. **Roll out Stage 3.5 (SIM)**
   - Start with offer‑roast; then full SIM tied to real drafts.
5. **Complete Stage 3 (Trace Explorer & Optimization)**
   - Give operators a trace explorer and pattern/ICP analytics so experiments and
     SIM feedback can be trusted and iterated on.

