# Task: Campaign Bump Auto-Generation Backend

**Date:** 2026-04-01
**Status:** Planned
**Owner:** backend / `crew_five`

## Goal

Implement canonical backend support so bump drafts can be generated automatically after intro delay,
reviewed by an operator, and only become sendable starting on the next local campaign day after
approval.

## Current State

Already implemented:

- canonical bump eligibility read model:
  [campaignFollowupCandidates.ts](/Users/georgyagaev/crew_five/src/services/campaignFollowupCandidates.ts)
- scheduler support for bump auto-send:
  [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts)
- direct send execution for approved eligible bump drafts:
  [campaignSendExecution.ts](/Users/georgyagaev/crew_five/src/services/campaignSendExecution.ts)

Missing:

- auto-generation trigger for bump drafts
- canonical protection against duplicate bump generation
- canonical “approved today, send tomorrow” gate
- explicit read-model visibility for bump review/send stages

## Required Behavior

### 1. Auto-generation candidate selection

For a contact to become a bump-generation candidate:

- latest intro was sent
- canonical bump delay is reached
- no reply
- no bounce
- no unsubscribe
- no complaint / suppression state that blocks follow-up
- no already sent bump
- no active bump draft already exists for the contact in the same campaign

### 2. Auto-generation execution

When such a candidate is found:

- backend triggers Outreach bump-generation bridge
- generation must be idempotent per `campaign_id + contact_id + email_type=bump`
- generation result must be recorded so the same contact is not re-generated on every sweep

### 3. Approval cooling gate

Bump drafts approved today must **not** be sendable today.

Send eligibility must require:

- draft is `approved`
- `approved_at` exists
- local campaign day at send time is strictly later than the local campaign day of `approved_at`
- all normal follow-up safety gates still pass

### 4. Re-evaluation before send

Even if a bump draft was generated and approved:

- if reply arrives later, do not send
- if bounce arrives later, do not send
- if unsubscribe/complaint arrives later, do not send

## Design Options

### Option 1 - New `bump_generation_requests` table

Pros:

- explicit workflow state
- strong auditability

Cons:

- biggest schema footprint

### Option 2 - Use draft metadata + deterministic scheduler only

Pros:

- smallest schema change
- fastest delivery

Cons:

- weaker audit/read-model clarity

### Option 3 - Hybrid: minimal request log + metadata

Pros:

- enough auditability
- lower overhead than full queue table

Cons:

- still requires careful state design

## Recommendation

Take **Option 3** if the schema change is affordable in this stage.

Fallback: use **Option 2** if fast delivery is more important than explicit workflow history.

## Required Backend Deliverables

1. New service for bump auto-generation candidate detection
2. New service/adapter hook for invoking Outreach bump generation
3. Idempotency guard for duplicate bump generation
4. Read-model support for:
   - generated bump drafts pending review
   - bump drafts approved today
   - bump drafts approved and sendable tomorrow
5. Send execution gate that blocks same-day post-approval bump sends
6. Focused tests for:
   - candidate detection
   - idempotency
   - same-day approval block
   - next-day eligibility
   - suppression override after approval

## Suggested Implementation Order

1. Add send gate first:
   - “approved today => not sendable today”
2. Add canonical bump generation trigger service
3. Add bridge hook in live adapter
4. Add read-model visibility for UI
5. Add scheduler integration

## Acceptance Criteria

- no eligible contact requires manual bump-generation trigger
- the same contact does not get duplicate bump drafts
- bump approved today is blocked from send today
- bump becomes sendable on the next eligible local day
- reply/bounce/unsubscribe after approval still blocks send
- tests cover both elapsed-day and business-day policy paths where relevant
