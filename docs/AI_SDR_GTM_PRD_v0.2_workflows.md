# AI SDR GTM System – PRD v0.2 (Workflow Extensions)

_Extends v0.1 – focuses on client selection, ICP discovery, and prospect-reaction
simulation._

> Base contract and architecture remain as defined in `docs/AI_SDR_GTM_PRD.md`
> (v0.1) and Appendix A (`docs/appendix_ai_contract.md`). This document adds
> workflow-level requirements for:
> - 0 – Client selection & first-email sequence
> - 1 – ICP discovery & prospect expansion (Exa + AnySite)
> - 2 – Prospect reaction simulation (SIM)

## 1. Scope & Relationship to v0.1

- **Spine unchanged**: All new workflows must still traverse the canonical spine
  `segment → segment_members → campaign → drafts → email_outbound → email_events`.
- **AI contract unchanged**: All draft-generation and sequence steps continue to
  call the same `generate_email_draft(email_type, language, pattern_mode, brief)`
  contract from Appendix A (Interactive Coach vs Pipeline Express modes).
- **Surfaces**:
  - CLI remains first-class for all new flows.
  - Web UI adds guided flows for selection, ICP discovery, and SIM.
- **Goal of v0.2**: Turn the system from “send good campaigns to known lists”
  into “discover the right prospects, design sequences, and de-risk messaging
  before scale”.

## 2. New Core Workflows

### 2.1 Workflow 0 – Client Selection & First-Email Sequence

**Goal**: Go from “Supabase has companies/contacts” to “validated, personalized
first email + bump email for a selected cohort, ready to send”.

**Actors**
- GTM Engineer / Founder via CLI and Web UI.
- Draft coach (Interactive Coach mode).

**High-level flow**
1. **Audience selection**  
   - UI: “Audience Selection” screen with filters over `companies`:
     - `created_at` / `updated_at`, `registration_date`
     - `segment`, `office_quantification`
     - `last_outreach_date` / `outreach_status`
   - Backend:
     - Accepts structured filter JSON and queries Supabase with guardrails
       (e.g. max 5k companies per session).
     - Persists filter definition + results snapshot as part of a
       `selection_session` or `campaign` record (reuses `segments` where
       possible).

2. **Company & contact resolution**
   - UI: “Contacts Review” screen:
     - Lists employees for selected companies with badges:
       `work email verified`, `generic email`, `no email`.
     - Allows inclusion/exclusion per contact and per company.
   - Backend:
     - Joins `companies` ↔ `employees`, computes counts.
     - Stores selections as `segment_members` (preferred) or a dedicated
       `campaign_contacts` table, with `include_in_campaign` flag.

3. **Offer & ICP clarification (coach prompt)**
   - UI: conversational panel “Coach: Define Your Offer & ICP” +
     structured summary cards:
     - Offer summary, target persona, pains, CTA, tone.
   - Backend:
     - Stores `offer_summary`, `icp_summary`, `email_tone`, `cta` as fields on
       `campaigns` or a linked `campaign_meta` table.
     - Uses Interactive Coach mode to refine a **base email** for an anchor
       contact.

4. **Base email review & learning from edits**
   - UI:
     - Rich editor for subject/body with merge-fields (chips for
       `{{first_name}}`, `{{company_name}}`, etc.).
     - Quick transforms (shorten, formalize, add social proof).
   - Backend:
     - Persists both:
       - LLM-original version.
       - User-edited version.
     - Optionally stores structured diffs for later pattern analysis.
     - Links versions to `drafts` and `email_outbound` via `pattern_persona` and
       `pattern_prompt_id`.

5. **Bulk personalization for cohort**
   - UI:
     - “Generated emails for selection” list with statuses:
       `OK`, `Needs Attention`, `Skipped (no email)`.
     - Filters by status; bulk select/deselect.
   - Backend:
     - For each selected contact, materializes a `draft` using:
       - Base template + merge fields.
       - Optional micro-personalization via AI SDK using existing research data
         (Stage 2).
     - Persists `drafts` with `status = generated` and any warnings (missing
       fields).

6. **Per-email refinement & control**
   - UI:
     - Per-contact view: manual edit, “regenerate” (single-contact call),
       exclude from campaign.
     - Global actions: “Cancel selection & discard drafts”, “Proceed to bump
       email”.
   - Backend:
     - Extends `drafts.status` to cover:
       `generated`, `edited_by_user`, `regenerated`, `excluded`.
     - Cancelling marks campaign and drafts as `cancelled` but keeps for
       analytics.

7. **Bump email generation & sequencing**
   - UI:
     - “Bump Email Setup” screen:
       - Delay rules (e.g. +3 days if no reply).
       - Tone/angle configuration.
     - Editor with same pattern as first email.
   - Backend:
     - Represents sequence steps as:
       - Step 1: `email_type = initial`.
       - Step 2: `email_type = bump`, `send_offset_days`, conditions
         (no reply, no positive outcome).
     - Each step still funnels through `drafts` and `email_outbound`, preserving
       the spine.

**Key requirements**
- Guardrails to avoid infinite micro-edits and regenerations (soft caps,
  nudges).
- Clear mapping between **selection session**, `segments`, `campaigns` and
  `drafts`.
- No parallel “sequence engine” outside the spine; sequences are modeled as
  additional metadata and state on campaigns/drafts/outbound.

### 2.2 Workflow 1 – ICP Discovery & Prospect Expansion (Exa + AnySite)

**Goal**: Turn loose ICP descriptions into structured profiles, run Exa Websets
searches, enrich contacts, and feed new prospects into the spine.

**Actors**
- User (AE / SDR / Founder).
- ICP Discovery & Prospect Expansion agent.
- Exa MCP server, AnySite MCP/API, existing enrichment providers.

**High-level flow**
1. **ICP definition session**
   - Interactive coach conversation to extract:
     - Company-level ICP (industry, size, geography, model).
     - Buyer personas (titles, function, pains, KPIs).
     - Hypotheses (“who is a good fit and why?”).
   - Output: structured ICP + hypotheses objects.

2. **Convert ICPs into Exa queries**
   - System (via ICP agent) transforms each ICP + hypothesis into multiple
     Websets queries:
     - Company-level (accounts).
     - Persona-level (roles at target companies).
     - Trigger-based (events like expansions, RFPs).
   - Adds filters for language, region, content type, timeframe.

3. **Run Exa searches via MCP**
   - Uses a dedicated MCP server (`exa-mcp-server`) with a limited tool
     surface (e.g. `exa_websets_search`).
   - Receives result sets containing URLs, snippets, and hints (company names,
     domains, context).

4. **Parsing, matching, and deduplication**
   - Extracts candidate companies and contacts:
     - Company: name, domain, industry, geography, size signals.
     - Person: names, titles.
   - Matches to existing Supabase records by domain and fuzzy name.
   - Creates or updates `companies` and `employees` with `source` and
     confidence metadata.

5. **Pre-import review**
   - UI:
     - Candidate companies and contacts with filters (country, size, industry,
       confidence).
     - User approves or discards entries before they become canonical rows.

6. **Contact enrichment (email + LinkedIn via AnySite)**
   - For selected companies/contacts:
     - Email enrichment and validation using existing providers.
     - AnySite integration to find LinkedIn profiles, headlines, and recent
       content.
   - Writes:
     - `email`, `email_status`, `linkedin_profile_url`, `linkedin_headline`,
       `social_metadata` into `employees`.

7. **Hand-off to segments and campaigns**
   - Newly imported/enriched records are:
     - Tagged by `icp_id` and `hypothesis_id`.
     - Made available to the segmentation engine to form new segments and
       campaigns.
   - Existing draft/campaign flows operate unchanged on these records.

**Key requirements**
- Minimal, explicit schema additions (see Section 3).
- Cost and volume controls for Exa/AnySite calls with user-visible estimates.
- Clear ICP/hypothesis tagging for downstream analytics (reply rates, meetings).

### 2.3 Workflow 2 – Prospect Reaction Simulation (SIM)

**Goal**: Before sending a campaign at scale, simulate how real prospects from
a target segment might react to a given draft, and surface actionable
improvements.

**Actors**
- User (Founder / AE / SDR).
- SIM agent (prospect-reaction simulator).
- AnySite / LinkedIn enrichment.

**High-level flow**
1. **Input selection**
   - Audience definition:
     - Segment / ICP (via existing `segments` or ICP objects).
     - Core value proposition and assumptions.
   - Seed prospects:
     - 5–10 real LinkedIn profiles from the target segment (via pasted URLs or
       previously enriched contacts).
   - Email draft:
     - Subject, body, CTA drawn from a `draft` or pasted manually.

2. **Persona emulation**
   - For each seed contact:
     - Enrich from LinkedIn and company context (via AnySite/Supabase).
     - Build a “life-world” persona:
       - Work context, stressors, mental models.
       - Decision and communication style.
       - KPIs, pains, inbox behavior.

3. **Agent-based inbox simulation**
   - Each persona receives the email in a simulated inbox:
     - Decides whether to notice, open, skim, or ignore.
     - Produces first emotional reaction (skeptical, annoyed, curious, etc.).
     - Evaluates KPI/pain alignment and priority (“ignore”, “maybe later”,
       “worth reply”, “urgent”).

4. **Aggregated analysis & recommendations**
   - SIM aggregates across personas to produce:
     - Pain alignment assessment.
     - Objections and risk flags (credibility, effort, cost).
     - Concrete copy suggestions (what to cut/add/reframe).
     - Personalization and deliverability hints:
       - Missing role/company references.
       - Spammy words or reply-blocking phrases.

5. **Super-light “offer roast” mode**
   - Alternative fast path where a “Skeptical Buyer” persona critiques:
     - Clarity, differentiation, believability, and proof.
   - No full persona/inbox simulation; lower cost and latency.

**Key requirements**
- Position SIM as **decision support**, not a replacement for real A/B tests.
- Provide clear, structured outputs (scores, bullet recommendations) that can
  be attached back to `drafts` or `campaigns`.
- Link SIM runs to future performance so the tool itself can be evaluated.

## 3. Data Model Extensions (Incremental to v0.1)

> Concrete SQL will live in Supabase migrations; this section describes the
> conceptual model.

### 3.1 ICP & Hypothesis

- `icp_profiles`
  - `id`
  - `name`
  - `description` (free text)
  - `company_criteria` (JSON: industry, size, geo, model)
  - `persona_criteria` (JSON: titles, functions, pains, KPIs)
  - `created_by`, `created_at`

- `icp_hypotheses`
  - `id`
  - `icp_id` (FK)
  - `hypothesis_label`
  - `search_config` (JSON used to build Exa queries)
  - `status` (draft / active / deprecated)

### 3.2 Source & Enrichment Metadata

- Extend `companies` and `employees` with:
  - `source` (enum: `manual`, `import`, `exa_websets`, `partner`, etc.).
  - `icp_id`, `hypothesis_id` (nullable FKs).
  - `confidence_score` (float).
  - Optional `exa_metadata` (JSON).

- Extend `employees` with:
  - `email_status` (enum: `valid`, `invalid`, `catch_all`, etc.).
  - `linkedin_profile_url`
  - `linkedin_headline`
  - `has_social_insights` (bool)
  - `social_metadata` (JSON)

### 3.3 SIM Runs

- `sim_runs`
  - `id`
  - `campaign_id` or `draft_id` (FK)
  - `mode` (`full_sim`, `offer_roast`)
  - `icp_id` (optional)
  - `seed_contact_ids` (array of `employees.id`)
  - `created_by`, `created_at`

- `sim_results`
  - `id`
  - `sim_run_id` (FK)
  - `employee_id` (FK to seed contact)
  - `emotional_reaction` (short label)
  - `priority_assessment` (enum: ignore / maybe / reply / urgent)
  - `kpi_alignment_score` (0–1)
  - `pain_alignment_score` (0–1)
  - `objections` (JSON array)
  - `recommendations` (JSON: cuts/additions/reframes)

## 4. AI & Agent Requirements (Delta)

- **New agents**:
  - ICP Discovery & Prospect Expansion agent:
    - Must operate within least-privilege MCP tool sets (`exa_websets_search`,
      selected AnySite tools).
    - Responsible for mapping ICPs → queries → candidates → Supabase writes.
  - SIM agent:
    - Uses enriched personas, email drafts, and (optionally) AnySite data to
      simulate reactions.
    - Must output structured JSON in addition to narrative feedback.

- **Existing agents** (Coach, CLI/web helper agents) stay bound by Appendix A
  and the spine; they may call new flows but not bypass the core contract.

- **AI SDK**:
  - Continues to manage routing, retries, and logging for all new calls.
  - SIM and ICP flows must log into `ai_interactions` and `api_traces` with
    clear tags (`icp_discovery`, `sim_run`).

## 5. Non-Functional & Guardrails (Delta)

- **Performance**:
  - ICP discovery and SIM are explicitly slower, asynchronous flows; UI must
    surface progress and allow the user to leave and return.
  - Exa/AnySite calls are batched with caps (per-ICP, per-run).

- **Cost & limits**:
  - Per-workspace configurable caps for:
    - Max companies per ICP run.
    - Max SIM runs per campaign.
  - User-visible cost approximations where possible.

- **Compliance & ethics**:
  - Clearly label inferred persona attributes as **simulated** and non-factual.
  - Respect AnySite and LinkedIn terms; avoid fully automated posting or
    high-volume connection invites.

- **Observability**:
  - All ICP and SIM flows must emit structured logs and traces, linked back to
    campaigns, drafts, ICPs, and hypotheses.

## 6. Release & Integration Notes

- v0.2 features are incremental; they must:
  - Reuse existing spine tables and CLI commands wherever possible.
  - Introduce new tables via Supabase migrations only.
  - Keep Web UI and CLI in capability parity for:
    - ICP creation/review,
    - SIM runs and result inspection,
    - Selection and sequence flows.

- Staging order (high level):
  1. Implement client-selection + sequence workflow on top of existing segments
     and campaigns.
  2. Add ICP/hypothesis storage and a minimal ICP discovery session (no Exa).
  3. Integrate Exa MCP and AnySite for a small, capped ICP discovery run.
  4. Add SIM “offer roast”, then full SIM with seed contacts.
  5. Connect SIM and ICP outcomes into analytics and prompt improvements.

## 7. Schema Alignment Notes (vs `docs/Database_Description.md`)

These differences are descriptive only; the canonical schema remains the
Supabase migrations, with `docs/Database_Description.md` needing a follow-up
update to match the PRD.

- **Companies – office field name**
  - Schema doc: `office_qualification` (`More`/`Less` via check constraint).
  - Workflows (0 + v0.2 PRD): reference `office_quantification` as a numeric
    or bucketed field for filters and UI.
  - Alignment note: decide on a single name + type (likely numeric/bucketed);
    update either the DB or docs to remove the mismatch.

- **Employees – outreach fields**
  - Schema doc: uses `outreach_sent_date`, `campaign_number`, `campaign_status`
    as primary outreach fields.
  - PRD (v0.1) and system plans: assume `outreach_status` and
    `last_outreach_at` on `employees` in addition to send metadata.
  - Alignment note: confirm whether `outreach_status` / `last_outreach_at` have
    been added in migrations; if so, extend `Database_Description.md`. If not,
    either add them or adjust PRD/system plan language to match existing
    fields.

- **Spine tables coverage**
  - PRD (v0.1) describes new tables:
    `segments`, `segment_members`, `campaigns`, `drafts`, `sender_profiles`,
    `prompt_packs`, `email_outbound`, `email_events`, `email_inbound`,
    `provider_accounts`, `fallback_templates`, `company_insights`,
    `employee_insights`, `api_traces`, `benchmark_results`.
  - Schema doc currently documents only `companies`, `employees`,
    and `ai_interactions`.
  - Alignment note: `Database_Description.md` should be expanded to document
    all spine and support tables that now exist per migrations/CHANGELOG.

- **ICP & enrichment fields**
  - v0.2 PRD introduces additional fields on `companies`/`employees`:
    - `icp_id`, `hypothesis_id`, `confidence_score`, `exa_metadata` on
      companies.
    - `email_status`, `linkedin_profile_url`, `linkedin_headline`,
      `has_social_insights`, `social_metadata` on employees.
  - Schema doc today mentions only `source` on companies and `source_service`
    / `ai_research_data` on employees.
  - Alignment note: these ICP/enrichment fields are not yet reflected in
    `Database_Description.md` and should be added once migrations land.

- **SIM tables**
  - v0.2 PRD adds conceptual tables `sim_runs` and `sim_results`.
  - `Database_Description.md` has no reference to them.
  - Alignment note: keep SIM tables out of the schema doc until migrations are
    applied; then add a dedicated subsection describing their role and
    key fields.
