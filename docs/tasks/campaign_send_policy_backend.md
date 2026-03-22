# Task: Campaign Send Policy Backend

**Date:** 2026-03-21
**Status:** Completed
**Owner:** backend

## Scope

Implement canonical campaign-level send calendar policy and enforce it in the auto-send scheduler.

This task is the backend follow-up after `v1` auto-send scheduler:

- auto-send intro + bump already exists
- `Outreach` already remains the executor
- `crew_five` already owns readiness and eligibility

What is still missing:

- campaign-local timezone/window/weekdays policy
- deterministic scheduler calendar gate

## Product Goal

The system must support campaigns for different regions without relying on one global scheduler
timezone or on LLM-only instructions inside `Outreach`.

Examples:

- RU campaign → `Europe/Moscow`, weekdays only, `9..17`
- EU campaign → `Europe/Berlin`, weekdays only, `9..17`
- US campaign → `America/New_York`, weekdays only, `9..17`

The scheduler must decide whether "now" is an allowed send time **per campaign**.

## Architectural Decision

Do not use `ICP` / `offer` metadata as the runtime source of truth.

Correct model:

1. `ICP` / `offer` may provide defaults
2. final send policy is stored explicitly on `campaigns`
3. scheduler reads only campaign-level policy

## Required Schema

Add explicit fields to `campaigns`:

- `send_timezone text not null default 'Europe/Moscow'`
- `send_window_start_hour integer not null default 9`
- `send_window_end_hour integer not null default 17`
- `send_weekdays_only boolean not null default true`

Validation expectations:

- `send_timezone` must be a valid IANA timezone at the service layer
- `send_window_start_hour` must be integer `0..23`
- `send_window_end_hour` must be integer `1..24`
- `send_window_end_hour` must be `>` `send_window_start_hour`

Do not introduce half-hour precision or minute-level windows in `v1`.

## Required Service Layer

### 1. Campaign send policy service

Suggested file:

- `src/services/campaignSendPolicy.ts`

Responsibilities:

- read policy from `campaigns`
- update policy with validation
- return one canonical view

Suggested view shape:

```json
{
  "campaignId": "camp-123",
  "campaignName": "Q2 Push",
  "campaignStatus": "review",
  "sendTimezone": "Europe/Moscow",
  "sendWindowStartHour": 9,
  "sendWindowEndHour": 17,
  "sendWeekdaysOnly": true,
  "updatedAt": "2026-03-21T12:00:00Z"
}
```

### 2. Calendar gate helper

Suggested file:

- `src/services/campaignSendCalendar.ts`

Responsibilities:

- evaluate whether a given `now` is inside the campaign-local send window
- evaluate whether weekday restriction allows sending
- return structured result, not just boolean

Suggested result shape:

```json
{
  "allowed": false,
  "campaignLocalTime": "2026-03-21T19:12:00+03:00",
  "reason": "outside_send_window"
}
```

Canonical reasons:

- `outside_send_window`
- `non_workday`

### 3. Scheduler integration

Update:

- `src/services/campaignAutoSend.ts`

New behaviour:

1. load campaign auto-send flags and campaign send policy in the same sweep
2. evaluate calendar gate before intro/bump eligibility
3. if blocked by calendar:
   - do not call `campaign:send-preflight`
   - do not call `campaign:followup-candidates`
   - do not trigger `Outreach`
   - return clear skipped result

Suggested skipped reason codes in sweep results:

- `calendar_outside_send_window`
- `calendar_non_workday`

Do not silently reuse env timezone for campaign-local checks.

## Required CLI Surface

Add:

- `campaign:send-policy:get`
- `campaign:send-policy:put`

These should mirror the existing style of:

- `campaign:auto-send:get`
- `campaign:auto-send:put`

Suggested usage:

```bash
pnpm cli campaign:send-policy:get --campaign-id <id> --error-format json
```

```bash
pnpm cli campaign:send-policy:put \
  --campaign-id <id> \
  --payload '{"sendTimezone":"Europe/Moscow","sendWindowStartHour":9,"sendWindowEndHour":17,"sendWeekdaysOnly":true}' \
  --error-format json
```

## Required Web Surface

Add:

- `GET /api/campaigns/:id/send-policy`
- `PUT /api/campaigns/:id/send-policy`

Keep response shape aligned with CLI/service view.

## Launch Flow Integration

Extend canonical launch flow so `campaign:launch:preview` / `campaign:launch` can accept optional
send policy fields.

Rules:

- if explicit values are provided in launch payload, persist them
- if omitted, use backend defaults
- do not read `ICP` / `offer` dynamically in scheduler

Optional later:

- prefill launch payload from `ICP` / `offer` in clients

## Required Tests

### Service tests

1. read campaign send policy
2. update campaign send policy
3. reject invalid timezone
4. reject invalid hour ranges
5. reject end hour `<=` start hour

### Calendar tests

1. campaign in `Europe/Moscow`, weekday, `10:00` → allowed
2. campaign in `Europe/Moscow`, weekday, `08:00` → blocked `outside_send_window`
3. campaign in `Europe/Moscow`, weekday, `17:30` → blocked `outside_send_window`
4. campaign in `Europe/Moscow`, Saturday, `10:00`, weekdays only → blocked `non_workday`
5. campaign in `America/New_York` evaluates using that local timezone, not server timezone

### Sweep tests

1. intro-enabled campaign inside window continues normal eligibility flow
2. bump-enabled campaign outside window is skipped before follow-up query
3. weekend-only block produces clear skipped reason
4. mixed auto-send campaign inside window still behaves as before

### CLI / Web tests

1. `campaign:send-policy:get`
2. `campaign:send-policy:put`
3. `GET /api/campaigns/:id/send-policy`
4. `PUT /api/campaigns/:id/send-policy`

## What Not To Do

- Do not hardcode `Europe/Moscow` in scheduler logic
- Do not make scheduler consult `ICP` / `offer` at runtime
- Do not add minute precision, holiday calendars, or complex cron windows in this task
- Do not move throttle logic from `Outreach` into `crew_five`
- Do not couple calendar gate to mailbox provider/runtime details

## Completed

- Added explicit campaign send policy columns on `campaigns`
- Added canonical `campaignSendPolicy` service with validation
- Added `campaignSendCalendar` helper for per-campaign local-time gating
- Integrated calendar gating into `campaignAutoSend` sweep results
- Added CLI:
  - `campaign:send-policy:get`
  - `campaign:send-policy:put`
- Added Web routes:
  - `GET /api/campaigns/:id/send-policy`
  - `PUT /api/campaigns/:id/send-policy`
- Extended `campaign:launch:preview` / `campaign:launch` to accept and return canonical `sendPolicy`
- Prepared frontend and Outreach handoffs

## Recommended Implementation Order

1. migration for campaign send policy fields
2. send policy service + tests
3. calendar helper + tests
4. scheduler integration + tests
5. CLI + Web routes
6. launch payload extension
7. docs + handoffs

## Follow-up

- Frontend should add send policy controls to `Campaigns` / `Builder V2` using the new endpoints.
- `Outreach` should treat launch-time send policy as the source of truth for future auto-send scheduling decisions.

## Required Docs / Handoffs After Completion

### Frontend

Prepare/update a frontend task covering:

- where send policy is edited in UI
- how current campaign-local send policy is shown
- how calendar-blocked auto-send state is displayed

### Outreacher

Prepare/update an `Outreach` handoff covering:

- `crew_five` now owns calendar policy enforcement
- `Outreach` should not decide campaign-local send window validity
- `Outreach` still owns send-time throttle inside a run
