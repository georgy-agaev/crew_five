# Requirements ID Scheme – AI SDR GTM System

> Version: v0.1 (2025-11-27)

This document defines how we assign and use stable requirement IDs across the PRD, AI contract appendix, and system roadmap.

## ID Structure

- IDs are short, stable strings with three parts:
  - `<AreaPrefix><WorkflowIndex>.<Number>`
  - Example: `W0.4`, `W1.2`, `SIM.3`.
- We avoid renumbering IDs once published; changes to behaviour are tracked as revisions to the same ID, or by adding new IDs (e.g., `W0.4a`).

### Area Prefixes

- `CORE` – cross-cutting requirements that apply to the whole system (spine, logging, error handling).
- `W0` – Workflow 0: Client selection & first-email sequence (v0.2 PRD).
- `W1` – Workflow 1: ICP discovery & prospect expansion (v0.2 PRD).
- `W2` – Workflow 2: Prospect reaction simulation (SIM) (v0.2 PRD).
- `INT` – Integration-specific requirements (Smartlead, EXA, AnySite, SMTP).
- `UI` – Web UI/UX requirements that are not specific to a single workflow.
- `TECH` – technical/operational requirements (observability, performance, resilience).

## Usage Across Docs

- `docs/AI_SDR_GTM_PRD_v0.2_workflows.md`
  - Each major requirement or workflow step is tagged with an ID (e.g., `W0.4_base_email_editing`, `W0.6_draft_status_flags`).
  - IDs appear near headings or bullet lists that define behaviour.
- `docs/appendix_ai_contract.md`
  - Contract notes reference the IDs they support (e.g., Pattern Breaker analytics section cites `W0.7_pattern_breaker_analytics`).
  - New fields are only added to the contract when required by specific IDs.
- `docs/GMT_system_plan_v0.3_roadmap.md`
  - Roadmap stages and workstreams list the IDs they deliver (e.g., “Stage B – Workflow 0: `W0.1–W0.7`”).
  - Acceptance criteria are expressed in terms of “IDs implemented + tests/docs complete”.
- `docs/GMT_system_plan_v0.4_roadmap.md`
  - Near-term execution roadmap that focuses on W0.v3, W1.v2, and AN.v2 while keeping W2 on contracts-only (Option 2).
  - References the same IDs and stages but narrows scope to the current priorities.
- `docs/sessions/YYYY-MM-DD_*.md`
  - Each session logs which IDs it advanced or completed (e.g., “Completed: `INT.1_smartlead_api_client`, `W0.7_pattern_breaker_analytics`”).

## Initial ID Examples (Illustrative)

These are examples to guide future tagging; IDs will be attached to concrete PRD sections as we iterate:

- `W0.4_base_email_editing` – Persist LLM-original + user-edited base email for Workflow 0.
- `W0.6_draft_status_flags` – Extend draft statuses (`generated`, `edited_by_user`, `regenerated`, `excluded`) for Workflow 0.
- `W0.7_pattern_breaker_analytics` – Track Pattern Breaker mode and prompt pack per draft for later analysis.
- `INT.1_smartlead_api_client` – Direct Smartlead API client for campaigns, leads, sequences.
- `INT.2_smartlead_direct_cli_commands` – CLI commands `smartlead:campaigns:list`, `smartlead:leads:push`, `smartlead:sequences:sync` wired to the Smartlead API client.

Future work will annotate PRD sections and roadmap items with these IDs and add new IDs as needed.
