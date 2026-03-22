# Task: Campaign Auto-Send Web UI

**Date:** 2026-03-21
**Status:** Done
**Owner:** frontend / Claude

## Context

`crew_five` backend now exposes canonical auto-send settings and canonical send readiness:

- `GET /api/campaigns/:id/auto-send`
- `PUT /api/campaigns/:id/auto-send`
- `GET /api/campaigns/:id/send-preflight`

The backend scheduler is intentionally headless in `v1`. Frontend work should expose the controls and
status, not reinvent eligibility logic.

## Goal

Let an operator:

1. see whether intro auto-send and bump auto-send are enabled for a campaign
2. change those settings from Web UI
3. see the canonical blockers/readiness from `campaign:send-preflight`

## Required UI behaviour

- Add a compact `CampaignAutoSendCard` to:
  - `Campaigns`
  - `Builder V2`
- Show:
  - intro enabled / disabled
  - bump enabled / disabled
  - bump delay in days
  - last updated timestamp if present
- Allow editing:
  - `autoSendIntro`
  - `autoSendBump`
  - `bumpMinDaysSinceIntro`
- Reuse canonical `send-preflight` for readiness / blockers display.

## Important constraints

- Do not add client-side auto-send eligibility logic.
- Do not estimate intro/bump readiness in the browser.
- Do not add mailbox quality or recipient scoring.
- Use the existing workspace shell, tokens, and card styles.

## Recommended interaction

1. load current settings via `GET /api/campaigns/:id/auto-send`
2. show inline toggles / delay input
3. save via `PUT /api/campaigns/:id/auto-send`
4. refresh `send-preflight`
5. show blockers first if the campaign is not ready

## Acceptance criteria

- Operators can enable/disable intro auto-send.
- Operators can enable/disable bump auto-send.
- Operators can set bump delay in days.
- Invalid delay values are blocked in UI before submit.
- UI reflects canonical backend state after save.
- UI shows canonical preflight blockers without duplicating backend logic.
