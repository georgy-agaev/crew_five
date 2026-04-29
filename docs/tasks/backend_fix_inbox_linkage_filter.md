# Bug: Inbox linkage=linked filter returns 0 results

**Date:** 2026-04-02
**Status:** Completed
**Owner:** backend / Codex
**Severity:** High — forces frontend to load all replies and filter client-side

## Problem

`GET /api/inbox/replies?linkage=linked` returns `total: 0` and empty array,
even though there are 42 campaign-linked replies in the database.

```bash
# Without linkage filter — 42 linked found in 500 results:
curl "http://localhost:8787/api/inbox/replies?limit=500"
# → total: 500, 42 have campaign_id != null

# With linkage filter — returns 0:
curl "http://localhost:8787/api/inbox/replies?linkage=linked"
# → total: 0, replies: []
```

## Impact

Frontend currently loads limit=1000 and filters client-side. This is slow and won't scale.

If `linkage=linked` worked correctly, frontend could load only campaign-linked replies
(~42 items instead of 1000) and filtering would be instant.

## Where to Fix

The inbox replies query in the backend — likely in `campaignEventReadModels.ts` or
the route handler in `analyticsRoutes.ts`. The `linkage` parameter is accepted but
the SQL filter is not applied correctly (or not at all).

## Expected Behavior

- `linkage=linked` → only replies where `campaign_id IS NOT NULL`
- `linkage=unlinked` → only replies where `campaign_id IS NULL`
- `linkage` omitted → all replies

## Additional Bug: limit=1000 returns 500 error

```bash
# limit=500 works:
curl "http://localhost:8787/api/inbox/replies?limit=500"
# → 200 OK, 0.55s

# limit=1000 crashes:
curl "http://localhost:8787/api/inbox/replies?limit=1000"
# → 500 Internal Server Error, 0.29s
```

Likely a Supabase response size / header overflow issue (same pattern as the audit bug).
The inbox query joins multiple tables and returns large payloads per row.

Implemented fix:
- Added chunked server-side paging in `campaignEventReadModels.ts` so the backend keeps scanning
  later `email_events` pages until it has enough filtered replies.
- This makes `linkage=linked` work even when the first raw page contains only unlinked mailbox
  traffic.
- The same chunked fetch path avoids the single oversized Supabase payload that caused the
  `limit=1000` crash.

## Verification

```bash
# linkage filter should work:
curl "http://localhost:8787/api/inbox/replies?linkage=linked&limit=50"
# Should return total: 42 (or current count of campaign-linked replies)

# high limit should not crash:
curl "http://localhost:8787/api/inbox/replies?limit=1000"
# Should return 200 OK
```

## Result

- `linkage=linked` now returns campaign-linked replies correctly.
- `linkage=unlinked` continues to work.
- `limit=1000` now returns `200 OK` through chunked paging instead of a backend crash.
