# Task: Campaign Send Policy Web UI

**Date:** 2026-03-21
**Status:** Done
**Owner:** frontend / Claude

## Context

`crew_five` backend now exposes canonical campaign-local send calendar policy and already enforces it
inside the auto-send scheduler.

Available backend surfaces:

- `GET /api/campaigns/:id/send-policy`
- `PUT /api/campaigns/:id/send-policy`
- `POST /api/campaigns/launch-preview`
- `POST /api/campaigns/launch`

Both launch endpoints now accept optional send policy fields and return resolved `sendPolicy`.

## Goal

Let an operator:

1. see the current send timezone/window/weekdays policy for a campaign
2. edit that policy from Web UI
3. see the same resolved send policy during launch preview and launch success

Do not redesign the workspace as part of this task.

## Backend contract to use

### Read current campaign policy

`GET /api/campaigns/:id/send-policy`

Response shape:

```json
{
  "campaignId": "camp-123",
  "campaignName": "EMEA Push",
  "campaignStatus": "review",
  "sendTimezone": "Europe/Berlin",
  "sendWindowStartHour": 8,
  "sendWindowEndHour": 16,
  "sendWeekdaysOnly": true,
  "updatedAt": "2026-03-21T12:00:00Z"
}
```

### Update current campaign policy

`PUT /api/campaigns/:id/send-policy`

Request body:

```json
{
  "sendTimezone": "America/New_York",
  "sendWindowStartHour": 9,
  "sendWindowEndHour": 17,
  "sendWeekdaysOnly": false
}
```

Validation already lives in backend:

- `sendTimezone` must be a valid IANA timezone
- `sendWindowStartHour` must be integer `0..23`
- `sendWindowEndHour` must be integer `1..24`
- `sendWindowEndHour > sendWindowStartHour`
- `sendWeekdaysOnly` must be boolean

### Launch flow integration

Both launch endpoints already accept optional send policy fields and return resolved `sendPolicy`.

`POST /api/campaigns/launch-preview`

Important request fields:

- `sendTimezone?`
- `sendWindowStartHour?`
- `sendWindowEndHour?`
- `sendWeekdaysOnly?`

Important response field:

- `sendPolicy`

`POST /api/campaigns/launch`

Important response field:

- `sendPolicy`

The UI must render the canonical `sendPolicy` from the backend response, not re-resolve it locally.

## Canonical choice rule

The UI is responsible only for collecting explicit operator intent:

- if `ICP` / `offer` / locale gives a usable hint, prefill the form and let the operator confirm or
  edit it
- if there is no usable hint, require explicit operator choice before preview/launch confirmation

Do not silently treat backend defaults as if they were business-approved values.

## Required UI behaviour

- Add a compact `CampaignSendPolicyCard` to:
  - `Campaigns`
  - `Builder V2`
- Show:
  - timezone
  - local start hour
  - local end hour
  - weekdays-only flag
  - last updated timestamp when present
- Allow editing:
  - `sendTimezone`
  - `sendWindowStartHour`
  - `sendWindowEndHour`
  - `sendWeekdaysOnly`
- In launch UI:
  - allow optional override before preview
  - render canonical `sendPolicy` returned by preview and launch

## Recommended entry points

1. `Campaigns`
   - Place the compact policy card near the other campaign controls (`send-preflight`, `auto-send`).
   - This is the main place for editing an already-created campaign.

2. `Builder V2`
   - Show the same compact card for an existing campaign if one is selected.
   - In the launch drawer/form, add optional send-policy inputs before preview.

Do not create a separate top-level page for send policy.

## Suggested component shape

Reusable pieces:

- `CampaignSendPolicyCard`
- launch-form section or subcomponent for send policy inputs

Suggested responsibilities:

- the card owns read/edit/save orchestration for existing campaigns
- launch flow owns temporary input state before `launch-preview`
- preview/success screens render backend-returned `sendPolicy`

## Required UI states

### Existing campaign card

- loading skeleton
- load error
- read-only display
- edit mode
- save pending
- save success
- save error

### Launch flow

- empty/default send policy values
- preview includes canonical resolved `sendPolicy`
- success includes persisted `sendPolicy`
- no-hint state requires explicit operator choice before continuing

## UI validation

Block submit in the browser for obvious invalid states:

- timezone empty
- start hour missing
- end hour missing
- end hour `<=` start hour
- non-integer hour values

Still render backend error messages directly if server validation fails.

## Important constraints

- Do not add browser-side calendar logic for “is now inside the window”.
- Do not infer timezone from ICP/offer in the browser.
- Do not add holiday calendars or minute precision.
- Reuse existing workspace shell, tokens, cards, and form styles.
- Do not duplicate send scheduler logic in the client.
- Do not add mailbox policy logic here.

## Explicitly out of scope

- holiday calendars
- minute precision windows
- per-day custom schedules
- mailbox warmup/readiness UI
- recipient quality scoring
- client-side “will send now” evaluation

## Acceptance criteria

- Operators can read current campaign send policy.
- Operators can update send policy from Web UI.
- Invalid hour ranges are blocked in UI before submit.
- Launch preview shows canonical resolved send policy.
- Launch success state shows the persisted send policy returned by backend.
- `Campaigns` and `Builder V2` both use the same backend contract for send policy.
- If no hint exists, the UI requires explicit operator confirmation instead of silently relying on
  backend defaults.
