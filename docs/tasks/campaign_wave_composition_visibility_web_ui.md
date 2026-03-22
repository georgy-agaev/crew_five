# Task: Campaign Wave Composition Visibility Web UI

**Date:** 2026-03-21
**Status:** Done
**Owner:** frontend / Claude

## Context

`crew_five` now extends canonical `campaign detail` with campaign-wave composition data:

- per-company `composition_summary`
- per-contact `recipient_email`
- per-contact `recipient_email_source`
- per-contact `sendable`
- per-contact `block_reasons`
- per-contact `eligible_for_new_intro`

This data already comes from:

- `GET /api/campaigns/:campaignId/detail`

Do not ask for a new backend endpoint for this task.

## Goal

Make campaign-wave composition and intro eligibility visible to operators in `Campaigns` without
redesigning the workspace.

Operators should be able to answer:

1. how complete a company is inside the current campaign wave
2. which contacts are sendable vs blocked
3. why a specific contact is blocked from a new intro

## Required UX Shape

### 1. Company-level composition visibility

In the `Companies` column, add a compact composition summary for the selected company or visible
company rows.

At minimum expose:

- total contacts
- sendable contacts
- eligible-for-new-intro contacts
- contacts with drafts
- contacts with sent outbounds

Blocked breakdown is useful, but keep it compact.

### 2. Employee-level block reasons

In the employee context / drill-down surface, show:

- current recipient email
- whether the contact is sendable
- whether the contact is eligible for a new intro
- block reasons when not eligible

Canonical block reasons already returned by backend:

- `no_sendable_email`
- `bounced`
- `unsubscribed`
- `already_used`

Do not invent new block labels in the browser. Map backend reasons to short operator-friendly text.

### 3. Composition empty states

When a company has employees but no contacts eligible for new intro:

- do not look broken
- show a compact explanation:
  - all contacts already used
  - all contacts suppressed
  - or no sendable email

Use the existing backend counters instead of recomputing large client-side summaries.

## Where To Integrate

Primary target:

- `Campaigns` operator desk

Suggested touchpoints:

- `Companies` column list rows or selected-company context
- employee drill-down / details surface

Do not create a new route or a full-screen campaign composition page.

## Backend Contract To Use

Use `GET /api/campaigns/:campaignId/detail`.

Important fields:

- `companies[].composition_summary`
- `companies[].employees[].recipient_email`
- `companies[].employees[].recipient_email_source`
- `companies[].employees[].sendable`
- `companies[].employees[].block_reasons`
- `companies[].employees[].eligible_for_new_intro`

## Constraints

- Do not redesign the four-column Campaigns layout.
- Do not duplicate suppression/sendability logic in the browser.
- Do not mix this task with draft editing or review flow changes.
- Do not add AI scoring or recommendations.

## Acceptance Criteria

1. Operator can see per-company campaign-wave composition without reading raw JSON.
2. Operator can see why a contact is blocked from a new intro.
3. UI wording matches backend semantics for `block_reasons`.
4. No new backend endpoint is required.
