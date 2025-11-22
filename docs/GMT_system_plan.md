# Outreach System – MVP Architecture & Staged Development Plan

This document captures the proposed approach for building a fast, staged outreach system using the existing Supabase database as the source of truth. It outlines the MVP scope, staged phases, necessary data structures, minimal web UI flows, and future upgrades.

---

## 1. Core Principles

1. **Use existing Supabase tables** for companies and employees to accelerate delivery.
2. **Avoid heavy enrichment early**; focus on draft generation and outreach orchestration.
3. **Use CSV imports temporarily** for company/employee updates until workflow is automated.
4. **Build the system in stages**: prototype quickly, then add enrichment, evaluation, and trace logging.
5. **Keep Supabase as the single source of truth**, with all services reading and writing through it.

---

## 2. Staged Development Roadmap

### **Stage 0.5 – Foundations (Minimal Setup)**
- Freeze minimal data contract for existing Supabase schema.
- Add essential status fields to employees.
- Introduce a simple logging table for outbound emails.
- Define CSV import/export formats.
- No UI complexity; backend only.

**Goal:** Ensure stable input/output before building product features.

---

### **Stage 1 – Draft Generation & Outreach Orchestration (Prototype)**
- Implement employee selection logic (100–300 contacts/day).
- Generate drafts using LLM workflows (subject + body, variants optional).
- Allow sending via SmartLead or SendEmail API using a unified sender abstraction.
- Minimal web UI with:
  - Segment selection
  - Draft preview & editing
  - Sender selection
  - Send/schedule
- Log basic sending metadata (employee, campaign, sender, timestamp).

**Outcome:** A working outreach prototype capable of real daily sending.

---

### **Stage 2 – Enrichment Layer (Value Boost)**
- Add EXA/Parallel/Anysite enrichment.
- Create `company_insights` and `employee_insights` tables.
- Store structured insights: summary, ICP fit, pains, angles, triggers.
- Integrate LLM-as-a-Judge for quality scoring.
- Leverage insights in draft generation to improve personalization.

**Outcome:** Much higher quality emails and stronger account intelligence.

---

### **Stage 3 – API Trace Logging & Observability**
- Add full trace model (latency, provider, cost estimates, errors).
- Implement a "Trace Explorer" tab in the UI.
- Connect traces to companies, employees, drafts, and sending.
- Support debugging and routing optimization.

**Outcome:** Full transparency into system decisions and performance.

---

## 3. Minimal Required Additions to Supabase

### **3.1. Employees Table (Add Fields)**
- `outreach_status` – never_contacted / queued / sent / responded / bounced / unsubscribed
- `last_outreach_at`
- `do_not_contact` (boolean)

### **3.2. Optional New Tables (For Clean Structure)**

**Email Outbound (Stage 1):**
- Records each email sent.
- Stores subject, body, provider, message_id.

**Company & Employee Insights (Stage 2):**
- Enriched summaries, ICP scoring, angles.

**API Traces (Stage 3):**
- Provider + latency + cost estimation + raw payloads.

---

## 4. Stage 1 Web UI (Minimal Prototype)

### **Screen 1 – Segment Selector**
- Filter by:
  - Industry
  - Country
  - Role title
  - Company size
- Show employees matched.

### **Screen 2 – Draft Preview**
- For each selected employee:
  - Display generated draft (subject + body).
  - Allow quick edits.
  - Select sender.

### **Screen 3 – Outreach Control**
- "Send all approved drafts" button.
- Show sending progress and errors.

### **Screen 4 – Basic Logs**
- Table of who was emailed, when, and via which sender.

---

## 5. Stage 2 Enhancements

### **Insights Panels**
- Company summary
- Persona overview
- Trigger events
- Value propositions

### **LLM-as-a-Judge**
- Score draft quality
- Suggest improvements
- Flag compliance/risk issues

---

## 6. Stage 3 Enhancements

### **Trace Explorer UI**
- Search by employee, company, campaign, run type.
- Visual timeline of model calls.
- Provider breakdown: latency, cost, failures.
- Export for debugging.

---

## 7. Future Extensions
- Sequence management without SmartLead.
- Automated follow-ups based on replies.
- In-app CSV import automation.
- Workspace-level analytics.
- CRM connectors.

---

## 8. Summary

This staged approach allows immediate practical value while keeping long-term architecture clean. The prototype becomes useful as soon as Stage 1 is complete, allowing real outreach to real prospects. Stages 2 and 3 then add intelligence, quality, and observability without blocking early progress.

Next step: define exact DB schema changes and API endpoints to implement Stage 1 smoothly.

