# Outreacher Auto-Send Scheduler Handoff

**Date:** 2026-03-21
**Audience:** Outreacher
**Status:** Active

## What is now canonical in `crew_five`

`crew_five` now owns:

- campaign-level auto-send settings
- campaign-level send calendar policy
- intro readiness via `campaign:send-preflight`
- bump eligibility via `campaign:followup-candidates`
- periodic auto-send sweeps in the live web adapter
- the command bridge that triggers `Outreach` send runtime

`Outreach` remains the executor that actually sends.

## New canonical campaign settings

Use:

```bash
pnpm cli campaign:auto-send:get --campaign-id <campaignId> --error-format json
pnpm cli campaign:auto-send:put --campaign-id <campaignId> --payload '<json>' --error-format json
pnpm cli campaign:send-policy:get --campaign-id <campaignId> --error-format json
pnpm cli campaign:send-policy:put --campaign-id <campaignId> --payload '<json>' --error-format json
```

Payload example:

```json
{
  "autoSendIntro": true,
  "autoSendBump": true,
  "bumpMinDaysSinceIntro": 3
}
```

Send policy example:

```json
{
  "sendTimezone": "Europe/Moscow",
  "sendWindowStartHour": 9,
  "sendWindowEndHour": 17,
  "sendWeekdaysOnly": true
}
```

## Trigger bridge contract

The live adapter executes `OUTREACH_SEND_CAMPAIGN_CMD`.

It calls `Outreach` with:

- `--campaign-id <campaignId>`
- `--reason auto_send_intro|auto_send_bump|auto_send_mixed`
- optional `--batch-limit <n>`

## What `Outreach` should do

### Intro path

When triggered with `reason=auto_send_intro`:

- treat this as a send run for approved intro drafts only
- rely on canonical preflight having already passed in `crew_five`
- do not regenerate drafts
- do not broaden the run to bumps

### Bump path

When triggered with `reason=auto_send_bump`:

- treat this as a send run for canonically eligible bump drafts only
- use `campaign:followup-candidates` semantics as the source of truth
- do not send intros in this path

### Mixed path

When triggered with `reason=auto_send_mixed`:

- the campaign currently has both intro and bump work eligible
- `Outreach` may handle both in one run
- but it must still keep intro and bump semantics separated internally

## Important boundaries

- `crew_five` decides eligibility and safety
- `crew_five` decides whether the campaign-local calendar allows the run right now
- `Outreach` executes sending
- `crew_five` scheduler must not silently approve drafts or invent a parallel workflow
- `Outreach` should not recompute canonical readiness rules differently from `crew_five`
- `Outreach` may still own throttle/sleep inside the run, but calendar gating is no longer a
  `SKILL.md`-only policy once the scheduler is involved
