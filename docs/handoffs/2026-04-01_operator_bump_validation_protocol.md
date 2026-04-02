# Operator Protocol: Bump Auto-Generation With Next-Day Send Gate

**Date:** 2026-04-01  
**Audience:** GTM operator / validation run owner  
**Status:** Planned

## Purpose

This protocol defines how to validate the new bump loop once backend + UI + Outreach bridge are
implemented.

## Target Operator Experience

1. intro emails are sent
2. after the configured delay, the system automatically generates bump drafts
3. operator reviews these bump drafts
4. operator approves selected drafts
5. approved bump drafts are **not** sent the same day
6. starting the next local campaign day, approved bump drafts become sendable
7. scheduler sends them if they are still safe

## Validation Scenarios

### Scenario 1 - Auto-generation appears without operator trigger

Expected:

- no manual “generate bump” action is required
- a reviewable bump draft appears after eligibility is reached

### Scenario 2 - Approval today does not send today

Expected:

- operator approves the bump draft
- UI shows equivalent of `sendable tomorrow`
- scheduler/manual send path does not send it on the same local day

### Scenario 3 - Next-day send works

Expected:

- on the next local campaign day, the same approved bump becomes sendable
- scheduler/manual send path can send it

### Scenario 4 - Reply arrives after approval

Expected:

- if recipient replies before the scheduled bump send
- bump is suppressed and not sent

## Validation Checklist

1. Choose a campaign with:
   - sent intros
   - no replies for at least one contact
   - bump auto-send enabled if end-to-end send validation is desired
2. Confirm bump delay is reached for at least one contact
3. Wait for/trigger the bump auto-generation sweep
4. Review generated bump drafts
5. Approve one or more drafts today
6. Confirm they are blocked from send today
7. Recheck on the next local campaign day
8. Confirm they become sendable and can be sent
9. Confirm a late reply still blocks send

## Success Definition

The flow is considered operational when the operator only has to:

- review bump drafts
- approve/reject them

and does **not** have to remember to manually request bump generation.
