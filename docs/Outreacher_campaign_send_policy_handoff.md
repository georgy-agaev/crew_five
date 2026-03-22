# Outreacher Campaign Send Policy Handoff

**Date:** 2026-03-21
**Audience:** Outreacher
**Status:** Active

## What is now canonical in `crew_five`

`crew_five` now owns explicit campaign-local send calendar policy:

- `sendTimezone`
- `sendWindowStartHour`
- `sendWindowEndHour`
- `sendWeekdaysOnly`

This policy is stored on `campaigns` and enforced by the auto-send scheduler before it evaluates
intro preflight or bump follow-up candidates.

## New CLI surfaces

Use:

```bash
pnpm cli campaign:send-policy:get --campaign-id <campaignId> --error-format json
pnpm cli campaign:send-policy:put --campaign-id <campaignId> --payload '<json>' --error-format json
```

Read example:

```bash
pnpm cli campaign:send-policy:get \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --error-format json
```

Payload example:

```json
{
  "sendTimezone": "Europe/Berlin",
  "sendWindowStartHour": 8,
  "sendWindowEndHour": 16,
  "sendWeekdaysOnly": true
}
```

Write example:

```bash
pnpm cli campaign:send-policy:put \
  --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 \
  --payload '{"sendTimezone":"Europe/Berlin","sendWindowStartHour":8,"sendWindowEndHour":16,"sendWeekdaysOnly":true}' \
  --error-format json
```

## Launch flow impact

`campaign:launch:preview` and `campaign:launch` now accept optional send policy fields.

Rules:

- if `Outreacher` already knows the campaign region/window, include it in launch payload
- if omitted, backend defaults apply
- scheduler later reads only the policy stored on the campaign row
- `sendPolicy` returned by preview/launch is the canonical resolved value and should be shown
  directly in summaries instead of being recomputed locally

`ICP` / `offer` may still help prefill these values in `Outreacher`, but they are no longer the
runtime source of truth once the campaign exists.

Recommended launch payload fragment:

```json
{
  "sendTimezone": "Europe/Berlin",
  "sendWindowStartHour": 8,
  "sendWindowEndHour": 16,
  "sendWeekdaysOnly": true
}
```

Recommended `/launch-campaign` behaviour:

1. use `ICP` / `offer` / locale only to prefill defaults
2. if no usable hint exists, ask the user explicitly for:
   - timezone
   - local start hour
   - local end hour
   - weekdays-only yes/no
3. do not silently accept backend defaults as if they were inferred business intent
4. pass explicit send policy fields into `campaign:launch:preview`
5. if confirmed, pass the same send policy fields into `campaign:launch`
6. show resolved `sendPolicy` from the backend response in the final summary

Decision rule:

- hint exists -> prefill and ask for confirmation/edit
- no hint exists -> require explicit operator choice before launch confirm

This keeps `Outreach` responsible for collecting user intent, while `crew_five` remains
responsible for validation and persistence.

## Scheduler behaviour

Before triggering `Outreach`, `crew_five` scheduler now checks campaign-local calendar policy.

Skip reasons:

- `calendar_outside_send_window`
- `calendar_non_workday`

When skipped by calendar:

- no intro preflight is executed
- no bump follow-up query is executed
- no `OUTREACH_SEND_CAMPAIGN_CMD` bridge call is made

Practical implication for `Outreach`:

- `send_campaign_cli.sh` should not assume that every configured auto-send campaign will always be
  invoked on every sweep
- absence of a trigger outside the local calendar window is expected and canonical
- throttle and per-run pacing still belong to `Outreach`, but calendar opening/closing does not

## Boundary

- `crew_five` owns calendar policy and deterministic scheduler gating
- `Outreach` owns send-time execution and throttle inside the send run

## What `Outreach` should not do

- do not infer runtime calendar policy from `ICP` / `offer` once the campaign already exists
- do not override campaign-local timezone/window silently inside `send-campaign`
- do not treat `SKILL.md` calendar text as the source of truth for auto-send after a campaign has an
  explicit policy in `crew_five`
