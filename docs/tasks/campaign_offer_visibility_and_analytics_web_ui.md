# Task: Campaign Offer Visibility And Analytics Web UI

**Date:** 2026-03-21  
**Owner:** Claude / UI  
**Status:** Done

## Goal

Finish the operator-facing UI follow-up for the canonical offer registry:

1. show campaign-linked offer context in normal campaign views, not only in launch success state
2. expose analytics grouped by canonical `offer_id`

## Backend Already Ready

- `GET /api/campaigns/:campaignId/detail`
  - now includes optional `offer`
- `GET /api/analytics/summary?groupBy=offer`
  - returns analytics grouped by canonical `campaigns.offer_id`
- legacy `groupBy=offering` still exists and remains separate

Reference:

- [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md)
- [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)

## Required UI Work

### 1. Campaign context: show offer

In `Campaigns` and `Builder V2` campaign context blocks:

- render linked offer when `campaign.detail.offer` exists
- show:
  - `title`
  - optional `project_name`
  - optional compact `description`
- keep it compact; this is context, not a separate management screen

### 2. Analytics UI: group by offer

Where analytics group selectors already exist:

- add `offer` as a selectable analytics group
- use `fetchAnalyticsSummary({ groupBy: 'offer' })`
- render group labels as:
  - `offer_title`
  - fallback to `offer_id` if title missing
  - optionally show `project_name` as muted secondary text

### 3. Do not conflate `offer` with legacy `offering`

- `offer` = canonical registry entity (`campaign.offer_id`)
- `offering` = legacy draft metadata (`offering_domain`)

UI must keep them as distinct dimensions.

## Out of Scope

- full offer CRUD workspace
- delete/archive flows
- analytics drill-down page redesign

## Acceptance Criteria

- campaign context surfaces show linked offer when present
- analytics UI can request and render `groupBy=offer`
- labels degrade gracefully when only `offer_id` is present
- no existing `offering` analytics behavior is broken
