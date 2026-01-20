# Session Notes — 2026-01-19 (Pipeline Send: Prepare Smartlead)

> Timestamp: 2026-01-19T22:20:18Z

## Overview
We implemented Option 1: the Pipeline workspace “Send” step now has a single CTA to **prepare Smartlead** from the
selected internal campaign, using the direct Smartlead API.

## Completed
- Pipeline Send step now supports **Prepare Smartlead** with:
  - Dry-run toggle (default on).
  - Batch size input (default 25).
  - One action that calls `POST /api/smartlead/send` with `{ campaignId, smartleadCampaignId, dryRun, batchSize }`.
- Updated helper copy and summary label to reflect “prepare” (not preview).
- Updated tests for `formatSendSummary` wording change.

## Notes
- “Prepare Smartlead” pushes leads from `segment_members → employees.work_email` and syncs one email sequence step
  from the first generated draft.
- Smartlead sends once the campaign is active in Smartlead (we still start/activate there for now).

## To Do
- Persist internal ↔ Smartlead campaign mapping in UI to avoid manual id selection.
- Add Smartlead campaign start/pause (if supported) to remove dashboard dependency.

