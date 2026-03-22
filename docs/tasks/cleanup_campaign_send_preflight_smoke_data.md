# Cleanup Temporary Campaign Send Preflight Smoke Data

**Status:** Completed on 2026-03-20
**Created:** 2026-03-20
**Context:** Live smoke verification for `campaign:send-preflight` created temporary campaigns and one temporary draft.

## Problem

Two temporary campaigns and related test records were created in live data during autonomous smoke verification:

- `Smoke Send Preflight 1774042247` (`2ed52a70-1147-468f-879b-e74798ee0ad0`)
- `Smoke Send Preflight Seq 1774042853` (`f531f780-3603-44d4-a14e-26a7cd331aee`)

The second campaign includes:

- one mailbox assignment
- one approved temporary draft

These records should not remain in production-like operator views indefinitely.

## Recommended Cleanup Scope

Delete:

- temporary campaigns
- related `campaign_mailbox_assignments`
- related temporary drafts

Keep:

- session logs documenting the smoke run

## Constraints

- Cleanup should happen only with explicit approval because it is destructive.
- Prefer one controlled cleanup path over ad-hoc manual SQL.

## Options

### Option 1 - Manual SQL / Supabase console

- Fastest
- Worst auditability

### Option 2 - One-time scripted cleanup

- Good for immediate cleanup
- Still ad-hoc

### Option 3 - Add admin CLI cleanup surface

- Best long-term hygiene
- More work than needed for just two temporary campaigns

## Recommendation

Use **Option 2** for the current cleanup after approval, then decide later whether an admin cleanup
surface is worth adding.

## Completed

Cleanup was executed on 2026-03-20.

Deleted:

- campaigns:
  - `2ed52a70-1147-468f-879b-e74798ee0ad0`
  - `f531f780-3603-44d4-a14e-26a7cd331aee`
- related `campaign_mailbox_assignments`
- related `drafts`

Verification after cleanup:

- `campaigns` rows: `0`
- `campaign_mailbox_assignments` rows: `0`
- `drafts` rows: `0`
