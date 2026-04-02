# Bug: Dashboard pending.inboxReplies excludes bounced events

**Date:** 2026-04-01
**Status:** Completed
**Owner:** backend / Codex
**Severity:** Medium — count mismatch between Home and Inbox

## Problem

`GET /api/dashboard/overview` returns `pending.inboxReplies: 0` while Inbox shows 1 unhandled
campaign-linked bounce.

The dashboard count only includes `event_type='replied'` events, but the Inbox page shows all
campaign-linked events including `bounced`. This creates a visible mismatch:
- Home: "0 Unhandled replies"
- Inbox: 1 item visible (a bounce)
- Sidebar badge: 0

## Data Evidence

```
# All linked replies (handled + unhandled):
GET /api/inbox/replies?linkage=linked → total: 18
  All 18 are event_type='bounced', reply_label=null

# Dashboard count:
GET /api/dashboard/overview → pending.inboxReplies: 0
```

## Expected Behavior

`pending.inboxReplies` should count all campaign-linked unhandled inbox events that appear
in the Inbox page, including:
- `event_type='replied'` (actual text replies)
- `event_type='bounced'` (delivery failures)

Both types appear in the Inbox UI and need operator attention.

## Where to Fix

`src/services/dashboardOverview.ts` — the query that computes `pending.inboxReplies`.

Currently filters to `reply_label IS NOT NULL` or similar — should include `event_type IN ('replied', 'bounced')` with `campaign_id IS NOT NULL AND handled_at IS NULL`.

## Frontend State

Frontend now uses `pending.inboxReplies` directly from dashboard (no client-side override).
Once backend count is fixed, Home and sidebar badge will show correct numbers automatically.

## Implemented

- `dashboardOverview.ts` now counts `pending.inboxReplies` from campaign-linked reply-type inbox
  events via the same shared reply-event guard that already includes:
  - `reply`
  - `replied`
  - `bounced`
  - `unsubscribed`
  - `complaint`
- The count now excludes:
  - unlinked inbox events (`campaign_id IS NULL`)
  - handled inbox events (`handled_at IS NOT NULL`)
- Added an explicit regression test covering the exact bug shape:
  campaign-linked unhandled `bounced` event increments `pending.inboxReplies`, while unlinked or
  handled bounces do not.

## Validation

- Focused test:
  [dashboardOverview.test.ts](/Users/georgyagaev/crew_five/src/services/dashboardOverview.test.ts)
