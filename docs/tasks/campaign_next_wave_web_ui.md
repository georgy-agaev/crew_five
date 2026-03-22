# Task: Campaign Next-Wave Web UI

**Date:** 2026-03-21
**Status:** Done
**Owner:** frontend / Claude

## Goal

Add a compact operator flow for creating the next campaign wave from an existing campaign, using the
canonical backend preview/create endpoints.

## Runtime clarification

Current factual runtime:

- `interactionMode` is not used by `Outreach`
- `dataQualityMode` is not used by `Outreach`

So next-wave UI should not expose these as operator-facing choices. Reused defaults should focus on
offer, hypothesis, send policy, and sender plan.

## Backend Ready

- `GET /api/campaigns/:campaignId/next-wave-preview`
- `POST /api/campaigns/next-wave`

## Required UI Behavior

1. Add `Create next wave` action from campaign context in:
   - `Campaigns`
   - `Builder V2`
2. Load next-wave preview before create
3. Show:
   - source campaign
   - reused defaults (`offer`, `hypothesis`, send policy, sender-plan summary)
   - `candidateContactCount`
   - `eligibleContactCount`
   - `blockedContactCount`
   - blocked breakdown chips
4. Allow operator to set:
   - new campaign name
   - optional target segment override later if backend exposes it in UI
5. Create the new wave via `POST /api/campaigns/next-wave`
6. Show success state with created campaign id and reused defaults

## UX Rules

- Do not rebuild next-wave logic in the browser
- Treat backend blocked reasons as canonical
- Keep `next-wave` separate from raw campaign launch
- Keep the flow compact; use a drawer/modal, not a full new screen
- Do not expose `interactionMode` / `dataQualityMode` as user choices

## Out of Scope

- auto-send next wave immediately
- offer rotation UI
- heavy history/analytics redesign
