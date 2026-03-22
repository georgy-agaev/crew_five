# Task: Campaign Send Policy And Calendar Gate

**Date:** 2026-03-21
**Status:** To Do
**Owner:** backend

## Context

Auto-send `v1` now exists, but its calendar behaviour is not yet code-enforced:

- `crew_five` scheduler currently does not block runs by weekday or local send window
- `Outreach` currently treats working hours / weekdays / throttle as LLM-policy in `SKILL.md`

This is not sufficient as the system expands beyond Russia. A single global
`Europe/Moscow` policy in env would be too rigid for EU/US campaigns.

## Decision

Do **not** treat `ICP` / `offer` metadata as the runtime source of truth for send calendar policy.

Instead:

1. `ICP` / `offer` may provide a default suggestion
2. the final send policy must be stored explicitly on the **campaign**
3. the scheduler must read only campaign-level send policy

## Recommended campaign-level policy

Add explicit campaign fields:

- `send_timezone`
- `send_window_start_hour`
- `send_window_end_hour`
- `send_weekdays_only`

Suggested defaults for RU campaigns:

- `send_timezone = "Europe/Moscow"`
- `send_window_start_hour = 9`
- `send_window_end_hour = 17`
- `send_weekdays_only = true`

## Required behaviour

### Launch / creation

- Launch flow may prefill send policy from `ICP` / `offer` defaults
- Operator or orchestrator should be able to override before final launch
- Final values must be persisted on the campaign

### Scheduler

- Before triggering auto-send, scheduler checks campaign send policy
- If current local campaign time is outside the allowed window:
  - skip the campaign
  - log a clear skip reason
- If `send_weekdays_only = true` and current local campaign day is Saturday/Sunday:
  - skip the campaign
  - log a clear skip reason

### Outreacher

- `Outreach` should not be responsible for deciding whether now is a valid campaign-local send time
- `Outreach` remains responsible for send-time throttle inside a run

## What not to do

- Do not hardcode one global timezone for all campaigns
- Do not infer scheduler runtime policy directly from `ICP` / `offer` on every sweep
- Do not leave calendar gate purely in `SKILL.md`

## Suggested implementation order

1. add campaign-level send policy fields
2. expose them in launch flow / campaign settings
3. add scheduler calendar gate
4. add UI controls and visibility
5. optionally let `Outreach` enforce code-based throttle separately

## Acceptance criteria

- Campaign stores explicit send timezone/window/weekdays policy
- Scheduler skips auto-send outside campaign-local send window
- Scheduler skips weekends when configured
- Skip reason is visible in logs / sweep result
- Launch flow can set the policy explicitly
