# Bug: Inbox and Dashboard filtering gaps

**Date:** 2026-04-01
**Status:** Completed
**Owner:** backend / Codex
**Severity:** High — operator-facing data quality issues

## Problem 1: Dashboard recent activity includes non-campaign events

`GET /api/dashboard/overview` returns `recentActivity` that includes bounced/replied events
not linked to any campaign. These clutter the operator Home page.

**Fix:** Filter `recentActivity` to only include events where `campaign_id IS NOT NULL`.

## Problem 2: Inbox `replyLabel` filter doesn't match UI categories

Backend `reply_label` values in the database: `replied`, `null`, `positive`, `negative`
UI categories: `positive`, `negative`, `bounce`, `unclassified`

The mapping should use `event_type` as fallback:
- `event_type='bounced'` → `bounce`
- `reply_label='positive'` → `positive`
- `reply_label='negative'` → `negative`
- everything else → `unclassified`

**Fix:** Add a `category` query param to `GET /api/inbox/replies` that maps to these UI categories
server-side, OR fix `replyLabel` to accept these mapped values.

## Problem 3: Inbox `linkage` filter returns 0

`GET /api/inbox/replies?linkage=linked` returns `total: 0` and empty replies array,
even though there are replies with `campaign_id IS NOT NULL`.

**Fix:** Implement `linkage` filter in the inbox replies query:
- `linked` → `campaign_id IS NOT NULL`
- `unlinked` → `campaign_id IS NULL`

## Problem 4: Dashboard `pending.inboxReplies` count mismatch

`pending.inboxReplies` counts events differently from what the inbox page shows.
The count should match: unhandled + campaign-linked replies only.

**Fix:** Update `dashboardOverview.ts` to count only events where
`campaign_id IS NOT NULL AND handled_at IS NULL`.

## Current Frontend Workarounds

Frontend currently:
- Loads all replies and filters client-side (slow with 200+ items)
- Computes category from `event_type` + `reply_label` client-side
- Loads separate inbox count for badge/home and filters by `campaign_id != null` client-side

These should be removed once backend filters work correctly.

## Implemented

- `GET /api/inbox/replies` now accepts server-side `category`:
  - `positive`
  - `negative`
  - `bounce`
  - `unclassified`
- Inbox category mapping is now canonical in backend read models:
  - `reply_label='positive'` → `positive`
  - `reply_label='negative'` → `negative`
  - `event_type='bounced'` → `bounce`
  - everything else → `unclassified`
- Inbox linkage filtering is enforced in backend read models and route parsing:
  - `linked` → campaign-linked only
  - `unlinked` → campaign-less only
- Dashboard reply activity now includes only campaign-linked reply-type events.
- `pending.inboxReplies` now counts only campaign-linked unhandled reply-type events.
- API client support for `category` was added so frontend can switch off client-side category
  filtering without inventing another adapter contract.

## Validation

- Added/updated focused tests:
  - [campaignEventReadModels.test.ts](/Users/georgyagaev/crew_five/src/services/campaignEventReadModels.test.ts)
  - [dashboardOverview.test.ts](/Users/georgyagaev/crew_five/src/services/dashboardOverview.test.ts)
  - [server.test.ts](/Users/georgyagaev/crew_five/src/web/server.test.ts)
  - [apiClient.test.ts](/Users/georgyagaev/crew_five/web/src/apiClient.test.ts)
- Quality gates:
  - `pnpm build` — passed
  - `pnpm lint` — passed
  - `pnpm test` — passed
