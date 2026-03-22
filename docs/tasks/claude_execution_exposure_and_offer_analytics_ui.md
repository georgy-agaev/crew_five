# Task: Claude UI Pass — Execution Exposure and Offer-Aware Analytics

**Date:** 2026-03-22
**Status:** Done
**Owner:** frontend / Claude

## Goal

Apply one coherent UI pass over the latest backend changes so operators can:

1. see historical execution exposure per contact in campaign views;
2. see the same exposure context in next-wave preview;
3. use the new analytics dimensions without confusing `offer` and `hypothesis`.

This task combines the follow-up work from:

- [campaign_execution_exposure_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_execution_exposure_web_ui.md)
- [offer_aware_analytics_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/offer_aware_analytics_web_ui.md)

## Backend Ready

### 1. Campaign detail

`GET /api/campaigns/:campaignId/detail`

Each employee row now includes:

- `exposure_summary`
  - `total_exposures`
  - `last_icp_hypothesis_id`
  - `last_offer_id`
  - `last_offer_title`
  - `last_sent_at`
- `execution_exposures[]`
  - `campaign_id`
  - `icp_profile_id`
  - `icp_hypothesis_id`
  - `offer_id`
  - `offer_title`
  - `project_name`
  - `offering_domain`
  - `offering_hash`
  - `offering_summary`
  - `first_sent_at`
  - `last_sent_at`
  - `sent_count`
  - `replied`
  - `bounced`
  - `unsubscribed`

### 2. Next-wave preview

`GET /api/campaigns/:campaignId/next-wave-preview`

Each preview item now includes:

- `exposure_summary`
  - `total_exposures`
  - `last_icp_hypothesis_id`
  - `last_offer_id`
  - `last_offer_title`
  - `last_sent_at`

### 3. Analytics

CLI/service now supports:

- `analytics:summary --group-by offer`
- `analytics:summary --group-by hypothesis`
- `analytics:summary --group-by recipient_type`
- `analytics:summary --group-by sender_identity`

If your analytics UI already calls the same backend groupings through the existing API client /
analytics surface, extend that selector rather than creating a parallel implementation.

## Product Rule

Do not flatten these dimensions into one label:

- `hypothesis` = targeting + messaging execution preset
- `offer` = business proposition
- `offering_*` = execution provenance from runtime metadata

The UI should help the operator distinguish them, not merge them.

## Required UI Work

### A. Campaigns employee context

In the existing employee context / drill-down surface:

1. Render `exposure_summary` compactly:
   - total exposures
   - last offer title
   - last touch date
   - hypothesis indicator
2. Add an expandable `execution_exposures[]` list:
   - offer title + project
   - campaign id or campaign label if already available in UI state
   - hypothesis id / label if already available
   - sent count
   - replied / bounced / unsubscribed badges
3. Keep this as a compact operator aid, not a new full-page history screen.

### B. Next-wave preview

In `CampaignNextWaveDrawer`:

1. Show `exposure_summary` per candidate row.
2. Make prior touch history legible before wave creation:
   - total exposures
   - last offer
   - last touch date
3. Keep blocked reasons and exposure memory visually separate:
   - blocked reason = why this candidate is not eligible now
   - exposure summary = what was already sent historically

### C. Analytics grouping UI

In the existing analytics surfaces:

1. Add grouping options for:
   - `offer`
   - `hypothesis`
   - `recipient_type`
   - `sender_identity`
2. Render labels cleanly:
   - `offer_title`
   - `project_name`
   - `hypothesis_label`
3. Keep `offer` and `hypothesis` visibly separate in copy and headings.
4. Do not add a new dashboard; extend the current operator analytics entry points only.

## UX Constraints

- Reuse existing cards / chips / context blocks where possible.
- Do not redesign Campaigns or Analytics layout wholesale.
- Prefer compact expand/collapse patterns over a new route.
- Exposure history should feel like operator context, not BI clutter.

## Out of Scope

- controlled rotation policy editing
- same-offer cooldown UI
- experimentation platform
- multi-project dashboards
- new backend endpoints

## Acceptance Criteria

1. Employee drill-down clearly shows `exposure_summary`.
2. Operators can inspect `execution_exposures[]` without leaving Campaigns.
3. Next-wave preview shows exposure context per candidate.
4. Analytics UI exposes `offer`, `hypothesis`, `recipient_type`, and `sender_identity`.
5. `offer` and `hypothesis` remain separate dimensions in labels and rendering.
