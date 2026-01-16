# Web UI Requirements and Prompt Guide

> Version: v0.1 (2025-12-01)
>
> Priority: This document is the authoritative source for the Web UI flows.
> Where it differs from other workflow docs (`docs/0_client_selection_email_workflow.md`,
> `docs/1_icp_discovery_exa_any_site_workflow.md`, `docs/2_sim_prospect_reaction_simulation_workflow.md`,
> `docs/GMT_system_plan_v0.4_roadmap.md`, `docs/gtm_system_workflows_versions_v_0.md`), this
> document takes precedence for UI behaviour and navigation. Keep cross-references updated.
>
> For the concrete HTTP endpoints used by the Web adapter and React app, see the companion
> endpoint catalog in `docs/web_ui_endpoints.md`.

## Navigation (tab order)
- **ICP & Coach (Tab 1)** – Generate/select ICP profiles and hypotheses (via coach prompt), bind to segment/campaign context.
- **Segments & Enrichment (Tab 2)** – Build segment filters, finalize snapshot v1, view counts/samples, enrich finalized segments, generate drafts (uses ICP/HYP selected).
- **SIM (Tab 3)** – Option 2 stub: submit SIM job, show job id/status “coming_soon”; no local scoring.
- **Analytics (Tab 4)** – AN.v2 dashboards: group-by ICP/HYP, Segment+Version+Role, Pattern+User_edited; prompt registry; optimize suggestions; sim summary.
- **Settings (Tab 5)** – Retry/assume-now/telemetry toggles.

## Workflow Requirements
**Step 1 – Segment filters (version 0)**
- Company filters: `company_name` (contains), `tin` (exact), `region` (contains), `sme_registry` (yes/no),
  `website` (contains), `revenue` (greater than input), `segment` (contains), `company_description` (contains),
  `office_quantification` (less/more), `created_at` (range), `updated_at` (range), `company_research` (contains).
- Employee filters: `position` (contains), `work_email` (toggle has/equals or has/none), `generic_email` (toggle),
  send-status buckets (never / >90d / <90d).
- Allow text/chat input to map a free-form request into structured filters (coach-assisted).
- Save as segment version 0.

**Step 2 – Snapshot and counts (version 1)**
- After selecting a v0 segment, display counts:
  - Companies
  - Employees with `work_email`, split by send-status buckets (never / >90d / <90d)
  - Employees with `generic_email`, split by the same buckets
- Actions: show detailed contacts table; or choose work_email/generic_email block and finalize snapshot v1.

**Step 3 – Post-snapshot handling**
- If members < 5: show full contact list.
- If members ≥ 5: show stats plus 5 random contacts; allow “shuffle sample” (re-draw 5) unlimited times before next stage.
- Enrichment (W0.v3): on finalized (v1+) snapshot only; trigger enrichment (adapter select, default mock), show last job status/id.

**Step 4 – Draft generation and review (Workflow 1)**
- Draft generation lives on Segments & Enrichment tab (not ICP tab).
- Require: finalized segment v1, campaign tied to that segment/version, selected ICP profile + hypothesis.
- Generate drafts (intro + bump) with metadata: `draft_pattern`, `coach_prompt_id`, `user_edited=false`, `icp_profile_id`, `icp_hypothesis_id`.
- Show drafts list: company, contact, position, email1/email2; allow re-generate per contact, allow user edits tracked via `user_edited`.

**Step 5 – Send prep**
- User picks send provider (Smartlead or Sendmail) and scope (selected leads vs all in segment).
- Confirm chain: segment → snapshot v1 → drafts → send job.

**Step 6 – Replies and follow-ups**
- Show inbound replies list.
- Provide suggested reply per lead using: originating `icp_hypothesis`, `pattern`, reply prompt; user can edit/approve.

**Analytics (AN.v2)**
- Groupings: ICP/HYP, Segment+Version+Role, Pattern+User_edited.
- Include prompt registry entries and optimize suggestions (scale/keep/retire).
- Include sim job summary (counts by status) for future SIM parity.

## How to use the Prompt Registry (Web UI)
- Open **Prompt Registry** tab (or the prompt section under Analytics).
- Create entry:
  - **coach_prompt_id**: stable ID for the variant (e.g., `icp_profile_v1`, `draft_value_prop_v1`). Immutable; new content ⇒ new ID.
  - **Step**: which flow the prompt belongs to (`icp_profile`, `icp_hypothesis`, or `draft`).
  - **Version**: version tag (e.g., `v1`, `v2`).
  - **Rollout status**: `pilot` (testing), `active` (live), `retired` (deprecated).
  - **Description**: short intent/note for teammates.
  - **Variant prompt text (optional)**: user-variant text; system scaffold stays fixed in code. Leave blank to register metadata only.
  - Click **Create** to add to the registry; entries become available for selectors.
- Selecting prompts:
  - Segments & Enrichment draft generation and campaign prompt selectors pull from the registry for per-step selections/bundles.
  - Analytics lists registry entries and optimize suggestions (scale/keep/retire) to guide rollout.
- Edits beyond rollout_status/description require a new `coach_prompt_id` (IDs are immutable).

## Prompt Templates (for UI coach surfaces)
Use these prompts in the UI to gather structured inputs.

### Prompt 1 – Generate/Refine ICP Profile
```
You are an SDR coach. Given brief inputs, produce a concise ICP profile.
Inputs: industry, geo, size band, key personas, top pains/signals, exclusion criteria, proof points (if any).
Output JSON:
{
  "icp_profile": {
    "name": "<short label>",
    "industry": "...",
    "geo": "...",
    "size": "...",
    "personas": ["role1", "role2"],
    "pains": ["..."],
    "triggers": ["..."],
    "exclusions": ["..."],
    "notes": "<one paragraph>"
  }
}
Keep it factual, no sales fluff.
```

### Prompt 2 – Generate Hypothesis + Segment Filters
```
You are a sales coach. Turn a plain-language request into:
1) icp_hypothesis (label, offer/angle, desired_outcome, funnel_position, CTA).
2) segment filters aligned to the data model.
Include company filters: company_name contains, tin exact, region contains, sme_registry yes/no,
website contains, revenue > X, segment contains, company_description contains,
office_quantification less/more, created_at range, updated_at range, company_research contains.
Include employee filters: position contains, work_email (has/equals/none), generic_email (has/equals/none),
send_status (never / sent_>90d / sent_<90d).
Output JSON:
{
  "icp_hypothesis": {...},
  "segment": {
    "name": "<segment label>",
    "version": 0,
    "filters": { "company": {...}, "employee": {...}, "send_status": {...} }
  }
}
Use defaults only when unspecified; never invent data.
```
