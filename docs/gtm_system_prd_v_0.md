# GTM System — Product Requirements Document (v0.1)

> Working name: **AI SDR GTM System** (AI SDR Toolkit + Outreach System)
> Source docs: Supabase Database Reference, Outreach MVP Architecture & Staged Plan, AI SDR Toolkit Architecture, macOS Setup Guide.

---

## 1. Product Overview

### 1.1 Problem

B2B founders and GTM teams waste time stitching together:

- Prospect research across multiple tools and tabs.
- CSV-based outreach workflows with fragile tracking.
- Ad-hoc prompt engineering in chatbots with zero audit trail.

Result: slow experimentation, inconsistent messaging by region/language, and no reliable feedback loop from performance back into the drafting process.

### 1.2 Solution Concept

**GTM System** is an AI-powered GTM operating system that:

- Uses **Supabase** as the single source of truth for companies, employees, campaigns, and AI interactions.
- Provides both:
  - A **CLI-native toolkit** for GTM engineers / power users (AI SDR Toolkit).
  - A **minimal web UI** for non-technical users to run targeted email campaigns.
- Orchestrates **research → drafting → sending → feedback** loops using LLMs, research adapters (EXA / Parallels / Anysite), and campaign tools (e.g., Smartlead/Leadmagic).
- Logs all AI/LLM runs for **observability, benchmarking, and provider routing**.

### 1.3 In-Scope (v0–v1)

- Core Supabase schema and migrations (companies, employees, campaigns, prompt runs, AI interactions).
- MVP outreach system:
  - Segment selection over Supabase data.
  - Draft generation via LLMs.
  - Manual review + edit.
  - Send via connected email / campaign provider.
- CLI toolkit that:
  - Imports companies/employees.
  - Triggers research workflows.
  - Runs prompt-pack–based drafting flows from the terminal.
- Basic observability (run logs, success/failure counters).

### 1.4 Out of Scope (for now)

- Full-blown CRM replacement (deep opportunity management, forecasting).
- Complex multi-channel orchestration (LinkedIn, cold calls, WhatsApp).
- On-premise deployment story.
- Complex multi-tenant SaaS billing.

---

## 2. Objectives & Success Metrics

### 2.1 Business Objectives

1. **Ship a working outreach prototype** that can send real campaigns to a live list within 4–6 weeks.
2. **Prove uplift vs. baseline**:
   - +X% increase in reply rate vs. “vanilla” templates on same segments.
   - Faster iteration: ability to launch a new experiment in < 30 minutes from idea to send.
3. **Create an extensible GTM platform** that can later absorb enrichment, LLM-as-a-Judge, and trace logging without schema rewrites.

### 2.2 Product Metrics (v1)

- Time-to-first-campaign from CSV import: **< 1 day**.
- Average time from “segment idea” to “campaign queued”: **< 30 min**.
- % of campaigns with properly logged inputs/outputs and trace IDs: **> 90%**.
- At least **2 languages** supported with stable quality (EN + RU) across a full campaign.

### 2.3 Guardrail Metrics

- Bounce rate below threshold (e.g. < 5%) using pre-flight checks.
- No more than N% of drafts flagged as high risk by LLM-as-a-Judge once introduced.
- Latency per typical workflow (segment selection → drafts prepared) under 60s for batches up to 200 contacts.

---

## 3. Users & Personas

### 3.1 GTM Engineer / Ops (Primary Internal User)

- Comfortable with CLI and YAML/TOML.
- Owns Supabase schema changes and workflows.
- Uses AI SDR Toolkit CLI to:
  - Import & normalize target lists.
  - Run research and drafting flows.
  - Diagnose issues via logs and traces.

### 3.2 Founder / Sales Lead (External Power User)

- Wants to validate new markets quickly.
- Uses web UI to:
  - Select segments.
  - Review & edit drafts.
  - Choose senders and schedule campaigns.
- Not expected to touch CLI or deep configuration.

### 3.3 SDR / AM (Future User)

- Uses pre-defined workflows built by GTM engineer.
- Stays mainly in web UI (queues, drafts, simple filters).

---

## 4. Core User Flows (MVP)

### 4.1 Company & Contact Intake

**Actor:** GTM Engineer (CLI)

1. Load a CSV from external source (list provider, CRM export).
2. Run `company:import` and `employee:import` commands (or equivalent) to push data into Supabase.
3. De-duplication via `tin` / `registration_number` (companies) and email (employees).
4. Tag imports with `session_key` and `batch_id` for idempotency.
5. Check import report: counts, rejected rows, reason codes.

**Success Criteria**

- No duplicate companies or employees created for same tax IDs/email.
- Import can be safely re-run with same CSV.

### 4.2 Segment Building & Campaign Setup

**Actor:** Founder/Sales Lead (Web UI)

1. Open “Segments” screen.
2. Build a filter over `companies` + `employees` (e.g. “RU-based SME fintech, title contains CTO/Head of IT, no outreach in last 60 days”).
3. Preview the list of employees and total count.
4. Save as “Segment” (e.g. `RU_Fintech_CTOs_Q1`).
5. Create a new Campaign:
   - Attach a Segment.
   - Select sender identity (mailbox / Smartlead account).
   - Pick a prompt pack / template (e.g., “Cold\_Bump\_Email\_Coach\_v2”).

**Success Criteria**

- Saved segment is reproducible and query definition is versioned.
- Campaign is created with a frozen snapshot of target employees + metadata.

### 4.3 Draft Generation & Review

**Actor:** Founder/Sales Lead (Web UI) / GTM Engineer (CLI)

1. Trigger draft generation for a campaign.
2. System fetches:
   - Company & employee records from Supabase.
   - Any existing `company_research`, `employee.ai_research_data`, and optional enrichment results.
3. LLM workflow (prompt pack + DSPy/GEPA) generates drafts:
   - Multiple variants per contact (e.g. Direct, Casual + Pattern Breaker).
4. Web UI displays drafts in a review table:
   - Employee, company, key personalization snippets.
   - Draft body, risk/quality score (when LLM-as-a-Judge is present).
5. User edits individual drafts, bulk applies tone tweaks, or excludes contacts.

**Success Criteria**

- Drafts generated for ≥95% of contacts in the segment (failures logged).
- User can edit/save without race conditions or losing work.

### 4.4 Sending & Feedback Loop

**Actor:** Founder/Sales Lead (Web UI), GTM Engineer (Backend/CLI)

1. User chooses:
   - “Send now” or “Schedule” with throttling parameters.
2. System:
   - Enqueues emails via Smartlead/Leadmagic or direct SMTP/SendEmail adapter.
   - Writes `campaign_number`, `outreach_sent_date`, `campaign_status` to `employees`.
3. Inbound reply collector (IMAP) tags responses and updates:
   - `reply_positive`, `reply_negative`, `reply_info_request`, `reply_bounce`.
4. Reporting screen shows:
   - Sent, delivered, bounced, replied.
   - Breakdown by segment, campaign, and provider.

**Success Criteria**

- Sending errors are visible with actionable reasons.
- Feedback loop updates within N minutes of reply arrival.

---

## 5. Functional Requirements

### 5.1 Data Model (Supabase)

- Use and extend existing tables:
  - `companies`: identity fields, research text, segments, SME flags, status, `session_key`, `batch_id`.
  - `employees`: contact details, outreach metadata, testing status, reply flags, provenance fields, `ai_research_data`.
  - `campaigns` (if not yet formalized): high-level campaign entity with name, segment definition, sender mapping, schedule, and status.
  - `ai_interactions`: logs of LLM runs, inputs, outputs, error codes, latency, cost estimates.
- Add tables for enrichment (Stage 2):
  - `company_insights`, `employee_insights` with structured fields: summary, ICP fit score, pains, triggers, recommended angles.
- Add tables for traces (Stage 3):
  - `ai_traces` or similar, with run graph, provider, tokens, and linkage to `ai_interactions` and campaigns.

**Constraints**

- Supabase remains the **single source of truth**; no additional shadow databases.
- RLS policies must keep things safe enough for future multi-workspace usage.

### 5.2 Segmentation Engine

- UI-driven filter builder for:
  - `segment`, `country`, `industry`, `sme_registry` on `companies`.
  - `position`, `client_status`, `campaign_status`, `outreach_sent_date` on `employees`.
- Support saved segments:
  - Store as serialized SQL or JSON query definition.
  - Version each segment so historical campaigns stay reproducible.
- Pagination and counts for large cohorts (10k+ employees).

### 5.3 Draft Generation Engine

- Integration with LLM providers (OpenAI, Anthropic, others via routing policy).
- Prompt-pack support:
  - Markdown prompt definitions parsed into a structured schema.
  - Versioning, linting, and simulation for each pack.
- DSPy/GEPA integration:
  - Multi-step workflows: collect context → plan → draft → refine.
  - Guardrails on tone, length, compliance constraints.
- Logging:
  - Each run writes record to `ai_interactions` with `session_key`, `batch_id`, `campaign_id`, `employee_id`.

### 5.4 Campaign Orchestration

- Campaign lifecycle:
  - Drafting → Ready → Sending → Completed → Archived.
- Pluggable send adapters:
  - Smartlead/Leadmagic first.
  - Ability to add SMTP/Resend/SendGrid later.
- Scheduling:
  - Basic throttling (emails per hour/day).
  - Time windows (e.g., local working hours).
- Error handling:
  - Retries with backoff.
  - Poison queue for bad addresses / configuration issues.

### 5.5 Web UI (MVP)

- **Login** (Supabase Auth; single-tenant for now).
- **Segments**:
  - List, create, edit, delete segments.
  - Preview results.
- **Campaigns**:
  - Create from segment, attach prompt pack and sender.
  - Monitor drafting and sending progress.
- **Draft Review**:
  - Table view with filters (e.g. show only high-risk drafts).
  - Inline editor with markdown/plaintext.
- **Reporting**:
  - Basic metrics by campaign: sent, bounced, replied, positive replies.

### 5.6 CLI Toolkit

- Commands (indicative; exact names can follow AI SDR Toolkit spec):
  - `company:import`, `company:list`, `company:inspect`.
  - `employee:import`, `employee:list`, `employee:export`.
  - `campaign:create`, `campaign:generate-drafts`, `campaign:status`.
  - `benchmark:run` for internal QA of prompt packs.
- Config:
  - Central config file (TOML/YAML) for Supabase, LLM providers, and routing rules.
- Local caching:
  - Cache for EXA and LLM calls to reduce cost and improve resilience.

---

## 6. Non-Functional Requirements

### 6.1 Reliability & Performance

- System must tolerate temporary LLM or provider outages:
  - Queue drafts and retries where possible.
- Target availability for core workflows (segment → draft → send): 99% during working hours.
- Draft generation batch of 200 contacts should complete within 2 minutes under normal load.

### 6.2 Security & Compliance

- All secrets stored in
