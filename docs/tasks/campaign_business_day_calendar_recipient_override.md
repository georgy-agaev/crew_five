# Task: Campaign Business-Day Calendar Recipient Override

**Date:** 2026-03-24
**Status:** Completed
**Owner:** backend

## Context

Campaign-country business-day logic is now complete and usable.

What remains open is the second phase from the original calendar roadmap:

- recipient-country business-day override

The current runtime spine still lacks a canonical recipient/company `country_code` that can safely
drive send-window and bump-delay decisions per contact.

## Why this is a separate task

This is no longer just a scheduler enhancement.

It needs:

- canonical country data in the audience spine
- stable fallback rules
- runtime branching by recipient geography
- better debugging for mixed-country campaigns

That is a data-model and runtime-read-model change, not only a calendar-library change.

## Goal

Add recipient-aware business-day logic while preserving campaign-level fallback as the final source
of truth.

Recommended mode:

- `business_days_recipient`

Behavior:

- if recipient/company country is known, use recipient calendar
- otherwise fall back to campaign calendar country

## Required changes

### Data model

Add canonical country fields:

- `companies.country_code`
- `companies.country_source`
- optionally `employees.country_code` later, only if person-level override is needed

### Runtime audience path

Expose `country_code` where follow-up/send logic can consume it:

- campaign audience read models
- follow-up candidate evaluation
- next-wave / future execution reuse paths where relevant

### Send policy

Extend day-count mode with:

- `business_days_recipient`

### Calendar evaluation

When mode is `business_days_recipient`:

- compute business day eligibility against recipient/company calendar
- fall back to campaign country when recipient country is missing

## Recommended implementation order

1. Add canonical `companies.country_code` and `country_source`
2. Backfill / normalize from existing enrichment and discovery fields where possible
3. Extend send policy mode with `business_days_recipient`
4. Update follow-up eligibility and scheduler calendar evaluation
5. Add operator-visible diagnostics so mixed-country behavior is debuggable

## Acceptance criteria

- campaigns can opt into `business_days_recipient`
- a known recipient/company country changes eligibility/calendar behavior accordingly
- missing recipient country falls back to campaign country
- tests cover mixed-country and missing-country cases
- operator surfaces preserve clear separation between:
  - campaign calendar default
  - recipient override behavior

## Completed

Delivered:

- new send policy mode:
  - `business_days_recipient`
- runtime calendar fallback:
  - recipient/company country first
  - campaign country fallback second
- bump eligibility now respects recipient-country business-day counting
- send execution now filters recipient-mode sends by recipient business-day availability
- campaign policy Web surfaces expose the new mode
- added company country persistence:
  - `companies.country_code`
  - `companies.country_source`
- enrichment path can now persist provider-derived alpha-2 country codes when available

## Migration note

This rollout requires applying:

- [20260324103000_add_company_country_calendar_fields.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260324103000_add_company_country_calendar_fields.sql)
