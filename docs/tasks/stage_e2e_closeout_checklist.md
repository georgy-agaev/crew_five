# Task: Stage E2E Closeout Checklist

**Date:** 2026-03-22
**Status:** Completed
**Owner:** shared

## Goal

Close the current roadmap stage with one explicit E2E verification pass before commit.

## Preconditions

1. Apply migrations:
   - `supabase db push`
2. Rebuild backend:
   - `pnpm build`
3. Restart adapter:
   - `pnpm dev:web:live`
4. Ensure Web UI points to the live adapter.

## E2E Scenarios

### 1. Campaign Launch

Verify a live campaign can be launched with:

- project
- offer
- optional hypothesis
- explicit send policy
- sender plan

Confirm resulting campaign stores and shows:

- `project_id`
- `offer_id`
- `icp_hypothesis_id`
- send policy
- sender plan

### 2. Campaign Operator Context

Open the campaign in `Campaigns` and verify:

- Companies column loads
- employee drill-down works
- send preflight renders
- offer and hypothesis are shown separately
- project context is visible once frontend project task is done

### 3. Builder V2 Previews

Verify both open without server errors:

- `Next wave`
- `Rotation`

Confirm they show:

- reused defaults
- blocked breakdown
- exposure summary

### 4. Send Runtime

Verify `Outreach` flow:

1. mailbox assignment resolve / confirm
2. `campaign:send-preflight`
3. stop on blockers
4. only then continue

### 5. Analytics

Verify operator-facing analytics can group by:

- offer
- hypothesis
- recipient type
- sender identity

## Finish Criteria

The stage is ready to commit when:

1. no launch / send / next-wave / rotation server errors remain in live UI
2. hierarchy stays explicit:
   - project
   - ICP
   - hypothesis
   - offer
   - segment
   - campaign
3. Claude confirms frontend finish-line tasks complete
4. Outreach confirms runtime finish-line tasks complete

## Notes

- Live operator smoke for current stage-closeout surfaces passed on `Campaigns` and `Builder V2`.
- The existing `web/e2e` Playwright package is a stale legacy segment/discovery suite and is not the
  correct automated gate for this stage; follow-up is tracked in:
  - [refresh_stage_e2e_playwright_suite.md](/Users/georgyagaev/crew_five/docs/tasks/refresh_stage_e2e_playwright_suite.md)
