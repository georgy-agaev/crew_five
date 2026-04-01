# Task: Campaign Execution Exposure Web UI

**Date:** 2026-03-22
**Status:** Done
**Owner:** frontend / Claude

## Goal

Use the already-expanded campaign read models to show historical execution exposure in operator UI.

## Completion Note

This task was completed in the Stage Closeout pass together with the related
offer/exposure analytics UI work. The remaining backlog is polish and roadmap
cleanup, not missing core UI capability.

## Backend Ready

- `GET /api/campaigns/:campaignId/detail`
  - `employees[].exposure_summary`
  - `employees[].execution_exposures[]`
- `GET /api/campaigns/:campaignId/next-wave-preview`
  - `items[].exposure_summary`

## Required UI Work

1. In employee drill-down / context card, render `exposure_summary` compactly:
   - total exposures
   - last hypothesis
   - last offer title
   - last sent at
2. Add a compact expandable list for `execution_exposures[]`:
   - campaign
   - offer title / project
   - hypothesis id or label when available
   - sent count
   - replied / bounced / unsubscribed badges
3. In next-wave preview UI, surface `exposure_summary` for each candidate so operator can see
   prior touch history before creating the wave.

## Out of Scope

- new backend endpoint
- offer rotation policy editing
- same-offer cooldown logic
- redesign of Campaigns layout
