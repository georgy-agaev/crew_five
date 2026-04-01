# Task: Campaign Business-Day Calendar Backend

**Date:** 2026-03-23
**Status:** Completed
**Owner:** backend

## Context

Current bump delay and auto-send calendar behavior are too primitive for cross-country outbound.

What exists now:

- bump delay is computed as elapsed 24-hour periods from `intro_sent_at`
- campaign send policy supports only:
  - `sendTimezone`
  - `sendWindowStartHour`
  - `sendWindowEndHour`
  - `sendWeekdaysOnly`
- auto-send calendar gate skips only Saturdays/Sundays in campaign-local time

This is not enough if:

- campaigns target countries with different public holidays
- recipient country matters more than campaign country
- operators want “5 business days after intro”, not “5 * 24h”

Important modeling constraint:

- `ICP -> hypothesis -> segment subset -> campaign wave` remains the spine
- `ICP` / `hypothesis` / `project` may suggest defaults
- runtime calendar policy must still be stored explicitly on the **campaign**

## Completed in this task

Phase 1 from the recommended path is now fully shipped and usable in the working operator flow.

Delivered:

- campaign send policy supports:
  - `sendDayCountMode`
  - `sendCalendarCountryCode`
  - `sendCalendarSubdivisionCode`
- holiday-aware campaign calendar evaluation is implemented via `date-holidays`
- bump eligibility supports:
  - elapsed days
  - business days by campaign calendar
- launch / launch preview / next-wave inheritance all carry the expanded policy
- Web operator surfaces now expose and validate the policy:
  - campaign send policy card
  - campaign launch form
  - launch preview
- active live campaigns can now be rolled forward operationally:
  - `ВКС-Less-30plus-2026-03`
  - `Пилот-Phase2-Гарнитуры-2026-02`
  with recipient-aware business-day mode plus `RU` fallback and campaign audience
  `companies.country_code` backfill where enrichment had not populated country yet

This means operators can now configure and use campaign-country business-day logic without leaving
the existing campaign workflow surfaces.

## Follow-up status

The original recipient-country override follow-up has now been completed in:

- [campaign_business_day_calendar_recipient_override.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_business_day_calendar_recipient_override.md)

## Current gaps

### Missing campaign fields

There were no explicit campaign-level country/business-calendar fields in the runtime policy shape.

### Missing recipient-country source of truth

The current open-core spine does not have a canonical recipient-country field that can safely drive
runtime scheduling for every contact. We have some `region` / discovery data, but not a
campaign-grade `country_code` model across the full audience path.

### Missing holiday engine

The original implementation only knew weekend vs non-weekend. It did not know national holidays.

### Missing business-day computation

The original `campaignFollowupCandidates.ts` path used elapsed days only, not business days, when
deciding bump eligibility.

## Options

### Option 1 — Campaign-country business days only

Add one campaign-level holiday calendar country and compute business days only from that calendar.

Pros:

- fastest implementation
- deterministic
- no need for recipient-country normalization first

Cons:

- wrong for mixed-country campaigns
- less precise when campaign spans multiple recipient geographies

### Option 2 — Campaign default + recipient override

Campaign stores a default holiday calendar country, but if a contact/company has canonical
`country_code`, runtime uses recipient country instead.

Pros:

- good accuracy
- practical migration path
- campaign still remains source of truth for fallback behavior

Cons:

- needs recipient-country normalization in audience read models
- more branching in runtime logic

### Option 3 — Recipient-country only

All business-day logic is determined per recipient/contact calendar.

Pros:

- best semantic precision

Cons:

- too expensive for a first rollout
- blocked on canonical recipient-country coverage
- higher operational/debug complexity

## Recommended path

Take **Option 2**, but implement it in two phases.

### Phase 1 — Campaign-country business days

Deliver a full working business-day calendar using campaign-level country only.

### Phase 2 — Recipient-country override

After campaign-country mode is stable, add canonical recipient-country support and allow
recipient-country override where data is available.

This gives us a safe rollout path without blocking on data-model cleanup first.

## Solution-first rule

Do not build a custom holiday engine from scratch.

Recommended approach:

- use a maintained holiday/calendar library such as `date-holidays`
- continue using IANA timezone handling already present in campaign send policy

Why:

- holiday logic by country/subdivision is error-prone to hand-maintain
- a maintained library is safer and faster than building custom holiday tables for v1

## Phase 1 scope

Status: Completed

### New campaign policy fields

Extend campaign send policy with:

- `sendDayCountMode`
  - `elapsed_days`
  - `business_days_campaign`
- `sendCalendarCountryCode`
  - ISO 3166-1 alpha-2, e.g. `RU`, `DE`, `US`
- `sendCalendarSubdivisionCode`
  - optional country subdivision / state / region where supported by the holiday provider

Notes:

- keep existing `sendTimezone`, `sendWindow*`, `sendWeekdaysOnly`
- for phase 1, `sendWeekdaysOnly` becomes backward-compatible fallback, not the primary
  business-calendar model

### Behavior changes

#### Auto-send scheduler

- If policy mode is `elapsed_days`:
  - current behavior remains
- If policy mode is `business_days_campaign`:
  - weekday/public holiday checks use the campaign business calendar
  - scheduler skips if today is not a business day in the campaign calendar

#### Bump eligibility

- `minDaysSinceIntro` must become:
  - elapsed days for `elapsed_days`
  - business days since intro for `business_days_campaign`

This logic belongs in:

- [campaignFollowupCandidates.ts](/Users/georgyagaev/crew_five/src/services/campaignFollowupCandidates.ts)

#### Launch / next-wave inheritance

- launch can set the new policy explicitly
- next-wave inherits the full calendar policy from the source wave

## Phase 2 scope

Status: Moved to follow-up task

### Canonical audience country

Add canonical company/contact country fields:

- `companies.country_code`
- optional `companies.country_source`
- optional `employees.country_code` only if we later need person-level overrides

Minimum viable rule:

- recipient country comes from company country unless contact-level override exists

### Recipient override mode

Extend `sendDayCountMode` with:

- `business_days_recipient`

Behavior:

- if recipient/company `country_code` exists, use that holiday calendar
- otherwise fall back to campaign-level country

## Required backend changes

### Schema

Phase 1 can be shipped safely without new campaign columns by persisting the additional policy
inside canonical campaign metadata.

This is the implementation path now in code.

Dedicated columns can remain a later hardening step if query/index pressure justifies them.

Phase 2:

- `companies.country_code text null`
- `companies.country_source text null`
- optional indexes if country-based filtering/read models need them

### Service layer

Update:

- [campaignSendPolicy.ts](/Users/georgyagaev/crew_five/src/services/campaignSendPolicy.ts)
  - validate new fields
  - resolve defaults
- [campaignSendCalendar.ts](/Users/georgyagaev/crew_five/src/services/campaignSendCalendar.ts)
  - replace weekend-only logic with holiday-aware business-day evaluation
- [campaignFollowupCandidates.ts](/Users/georgyagaev/crew_five/src/services/campaignFollowupCandidates.ts)
  - compute `business_days_since_intro`
  - preserve `elapsed_days` mode
- [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts)
  - use updated calendar evaluation
- [campaignLaunchPreview.ts](/Users/georgyagaev/crew_five/src/services/campaignLaunchPreview.ts)
  - accept/return new policy
- [campaignLaunch.ts](/Users/georgyagaev/crew_five/src/services/campaignLaunch.ts)
  - persist new policy
- [campaignNextWave.ts](/Users/georgyagaev/crew_five/src/services/campaignNextWave.ts)
  - inherit new policy

### New helper(s)

Recommended new helpers:

- `campaignBusinessCalendar.ts`
  - holiday/business-day evaluation
- `campaignBusinessDayDelay.ts`
  - compute business days between intro and now

## CLI / Web surface changes

### CLI

Extend:

- `campaign:send-policy:get`
- `campaign:send-policy:put`
- `campaign:launch:preview`
- `campaign:launch`

to support:

- `sendDayCountMode`
- `sendCalendarCountryCode`
- `sendCalendarSubdivisionCode`

### Web

Current Web UI should eventually expose:

- day-count mode
- campaign country calendar
- optional subdivision

But phase 1 backend should ship first even if UI lags behind, as long as defaults are explicit.

## Outreach implications

### Phase 1

`Outreach` should:

- keep treating campaign send policy as canonical
- optionally prefill campaign country defaults from project / ICP / hypothesis
- not implement its own business-day logic

### Phase 2

If recipient-country mode is enabled:

- `Outreach` still does not own calendar math
- `crew_five` remains the authority for eligibility and scheduler decisions

## Acceptance criteria

### Phase 1

- Campaign policy can store country-based business-day mode
- Scheduler skips campaign on non-business days for campaign country
- bump eligibility supports business days by campaign country
- launch and next-wave persist / inherit the new policy
- logs / sweep results expose clear skip reasons

## Completed This Session

### Phase 1 backend foundation implemented

The first working campaign-country business-day foundation now exists in code.

Completed:

- added campaign policy mode support in
  [campaignSendPolicy.ts](/Users/georgyagaev/crew_five/src/services/campaignSendPolicy.ts)
  for:
  - `elapsed_days`
  - `business_days_campaign`
- added metadata-backed persistence for:
  - `sendDayCountMode`
  - `sendCalendarCountryCode`
  - `sendCalendarSubdivisionCode`
- integrated a maintained holiday engine via `date-holidays`
- updated
  [campaignSendCalendar.ts](/Users/georgyagaev/crew_five/src/services/campaignSendCalendar.ts)
  to evaluate campaign business days with holiday awareness
- updated
  [campaignFollowupCandidates.ts](/Users/georgyagaev/crew_five/src/services/campaignFollowupCandidates.ts)
  to compute `business_days_since_intro`
- updated launch and next-wave policy persistence / inheritance

### Implementation note

Phase 1 is currently **metadata-backed**, not column-backed.

That is acceptable for the current stage because:

- the runtime owner is the campaign
- launch / next-wave already persist the policy correctly
- scheduler and followup eligibility already consume the policy correctly

### What is not done yet

- recipient-country override is **not** implemented
- canonical audience-level `country_code` still remains future work
- `business_days_recipient` mode remains out of scope for this phase

### Phase 2

- canonical recipient/company country exists in the audience path
- recipient-country override mode works with campaign fallback
- bump eligibility and scheduler use recipient country when configured

## Implementation order

1. keep metadata-backed campaign-country mode as the current production-safe phase
2. verify CLI / Web surfaces expose the new policy explicitly where needed
3. only after execution-layer migration, add canonical recipient-country fields
4. then add `business_days_recipient`

## What not to do

- do not infer runtime country directly from `ICP` / `offer` on every sweep
- do not build a custom holiday engine by hand for v1
- do not make recipient-country mode the first rollout
- do not let `Outreach` own business-day math separately from `crew_five`
