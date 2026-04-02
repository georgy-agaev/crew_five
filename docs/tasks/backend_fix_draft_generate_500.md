# Bug: POST /api/drafts/generate returns 500

**Date:** 2026-04-01
**Status:** Completed
**Owner:** backend / Codex
**Severity:** High — blocks draft generation from Web UI

## Problem

`POST /api/drafts/generate` returns `{"error":"Server error"}` (HTTP 500) for any campaign.

```bash
curl -s -X POST http://localhost:8787/api/drafts/generate \
  -H 'Content-Type: application/json' \
  -d '{"campaignId":"dad76931-0ef5-4144-a84a-eaa4ae759334","dryRun":true}'
# → {"error":"Server error"}
```

## Root Cause

The endpoint was wired to the local `crew_five` `generateDrafts(...)` service, but the current
runtime split says draft generation is owned by `Outreach`.

So the Web UI was calling the wrong backend path:

- frontend button was correct,
- route `/api/drafts/generate` existed,
- but live adapter wiring still pointed to local draft generation instead of the Outreach bridge.

That mismatch produced the 500s seen from Builder/Campaigns.

## Fix Applied

1. Added a dedicated live adapter bridge:
   - `src/web/liveDeps/generateDraftsTrigger.ts`
2. Switched `createLiveDeps.generateDrafts` to call the Outreach runtime instead of local
   `crew_five` generation.
3. Added `OUTREACH_GENERATE_DRAFTS_CMD` as the required live-mode env for this path.
4. Added regression tests for:
   - command parsing / invocation
   - live adapter routing to Outreach when configured

## Operator Note

For live draft generation from Builder/Campaigns, the adapter now requires:

```bash
OUTREACH_GENERATE_DRAFTS_CMD="outreach generate-drafts"
```

If that env is missing, the endpoint now fails with an explicit configuration error instead of
silently falling back to the wrong runtime.

## Frontend State

`CampaignDraftGenerateCard` is already integrated into Campaigns and Builder V2.
It calls `POST /api/drafts/generate` with `dryRun: true` for preview, then `dryRun: false` to confirm.
Once the backend endpoint works, the UI will function immediately — no frontend changes needed.
