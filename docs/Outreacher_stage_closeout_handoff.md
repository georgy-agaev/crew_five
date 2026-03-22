# Handoff: Outreach Stage Closeout

**Date:** 2026-03-22
**Status:** To Do
**Owner:** Outreach

## Goal

Use this as the single runtime-alignment handoff before E2E verification and stage-closeout commit.

## Canonical `crew_five` Surfaces Ready

### Launch / Setup

- `project:list`
- `project:create`
- `project:update`
- `offer:list`
- `offer:create`
- `offer:update`
- `icp:hypothesis:list`
- `icp:hypothesis:create`
- `campaign:launch:preview`
- `campaign:launch`
- `campaign:send-policy:get`
- `campaign:send-policy:put`
- `campaign:mailbox-assignment:get`
- `campaign:mailbox-assignment:put`

### Runtime / Send

- `campaign:send-preflight`
- `campaign:followup-candidates`
- `campaign:auto-send:get`
- `campaign:auto-send:put`

### Wave / Rotation

- `campaign:next-wave:preview`
- `campaign:next-wave:create`
- `campaign:rotation:preview`
- `campaign:attach-companies`

### Analytics / Read Models

- `campaign:detail`
- `campaign:audit`
- `analytics:summary --group-by offer`
- `analytics:summary --group-by hypothesis`
- `analytics:summary --group-by recipient_type`
- `analytics:summary --group-by sender_identity`

## Confirmed Runtime Alignment

Already confirmed in this session:

- `interactionMode` is not used
- `dataQualityMode` is not used
- `coach` is not a real runtime path

So these must stay out of operator-facing launch / next-wave runtime.

## Required Runtime Rules

### Hierarchy

Keep this explicit:

- project = workspace / business boundary
- ICP = targeting root
- hypothesis = execution preset under ICP
- segment = subset of that audience
- campaign = wave over that subset
- offer = business proposition / execution context

Do not treat `project`, `offer`, or `hypothesis` as interchangeable.

### Launch

Launch flow should now use:

1. resolve / create project
2. resolve / create offer
3. resolve / create optional hypothesis
4. resolve sender plan
5. resolve explicit send policy
6. `campaign:launch:preview`
7. `campaign:launch`

### Send

Send flow should now use:

1. `campaign:mailbox-assignment:get`
2. optional `campaign:mailbox-assignment:put`
3. `campaign:send-preflight`
4. stop on blockers
5. only then continue to generate / sending orchestration

### Next Wave

Next-wave flow should now use:

1. `campaign:next-wave:preview`
2. confirm name
3. `campaign:next-wave:create`

Reused defaults come from source wave; do not recompute them locally unless operator explicitly edits
 them.

### Rotation

Rotation is preview-only:

1. `campaign:rotation:preview`
2. keep source ICP / hypothesis / offer visible
3. do not auto-create a rotated wave

## Important Consistency Errors

Treat these as canonical failures, not retryable transport noise:

- `CAMPAIGN_PROJECT_MISMATCH`
- `ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH`
- `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`

## Stage E2E Checklist

Before stage-closeout commit, verify:

1. `/launch-campaign` with project + offer + optional hypothesis
2. `/send-campaign` with send preflight
3. `--next-wave --source-campaign-id ...`
4. `campaign:rotation:preview`
5. analytics summaries grouped by:
   - offer
   - hypothesis

## Notes

- auto-send calendar gating is owned by `crew_five`
- send-time throttle remains owned by `Outreach`
- `OUTREACH_SEND_CAMPAIGN_CMD` should remain the real shell entrypoint, not a placeholder
