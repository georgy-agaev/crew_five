# Task: Campaign Offer Registry Web UI

**Date:** 2026-03-21  
**Owner:** Claude / UI  
**Status:** Done

## Goal

Add minimal offer selection/creation to the campaign launch UI so operators do not have to keep
offer identity only in memory or only in `Outreach`.

## Backend Contract Already Ready

- `GET /api/offers`
- `POST /api/offers`
- `PUT /api/offers/:offerId`
- `POST /api/campaigns/launch-preview`
- `POST /api/campaigns/launch`

Reference:

- [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md)
- [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)

## Required UI Work

### 1. Launch drawer: offer picker

In the existing campaign launch flow:

- load offers from `GET /api/offers`
- show a compact selector for active offers
- persist selected `offerId` in local launch form state
- pass `offerId` into:
  - launch preview request
  - launch mutation request

### 2. Inline offer create

If no suitable offer exists:

- provide a lightweight inline create path
- minimum fields:
  - `title`
  - optional `projectName`
  - optional `description`
- create via `POST /api/offers`
- after success:
  - refresh offer list
  - auto-select the newly created offer

### 3. Preview / success visibility

In launch preview and launch success states:

- show selected offer title
- if present, show `project_name` as muted secondary text
- do not invent new derived offer fields client-side

## Validation Rules

- launch should still work without `offerId`
- if operator selected an offer, the request must include `offerId`
- inline create must reject empty `title`

## Out of Scope

- dedicated offer management screen
- delete/archive UI
- offer analytics
- editing existing offers from the launch drawer

## Recommended UX Shape

Keep it compact:

- normal case: dropdown/listbox with active offers
- secondary CTA: `New offer`
- inline create form opens below the selector, not in a separate full-screen flow

## Acceptance Criteria

- operator can launch a campaign with explicit `offerId`
- operator can create a new offer inline and use it immediately
- preview and success states show which offer was selected
- tests cover:
  - offers load
  - select existing offer
  - inline create
  - request payload includes `offerId`
  - Russian locale text
