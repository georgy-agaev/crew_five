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
