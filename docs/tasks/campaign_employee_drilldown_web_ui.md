# Task: Campaign Employee Drill-Down Web UI

**Date:** 2026-03-21
**Status:** Done
**Owner:** frontend / Claude

## Context

`Campaigns` operator desk is now stable on the backend side:

- company context in the `Companies` / `Employees` columns uses canonical fallback from `companies`
- employee lists come from `GET /api/campaigns/:id/detail`
- the `Messages` column already has a compact employee context card

The remaining gap is operator usability:

- selecting an employee still feels like selecting a row without a full profile
- employees with no drafts are technically valid, but the empty state is not actionable enough
- there is no lightweight employee drill-down surface

## Goal

Improve operator comprehension in `Campaigns` without redesigning the workspace:

1. make selected employee context feel explicit and inspectable
2. make “no drafts yet” / “no message in current filter” states actionable
3. keep the current four-column desk intact

## Backend Surface Already Available

- `GET /api/campaigns/:campaignId/detail`
- `GET /api/drafts?campaignId=<id>&includeRecipientContext=true`
- `GET /api/campaigns/:campaignId/outbounds`
- `GET /api/campaigns/:campaignId/events`

Do not ask for new backend endpoints in this task unless a truly blocking gap is found.

## Required UX Shape

### 1. Employee drill-down

Add a lightweight employee drill-down surface, not a brand-new page.

Recommended options, in order:

1. compact inline expand below the employee card in `Messages`
2. small drawer / side panel from the employee card

Do not implement a full-screen employee profile.

### 2. Drill-down content

Show:

- full name
- role / position
- company name
- recipient email currently used
- work email
- generic email
- sendability
- intro / bump coverage
- sent count
- reply count
- draft status summary when drafts exist
- outbound / event summary when data exists

The goal is operator clarity, not exhaustive CRM detail.

### 3. Empty states

When an employee is selected but there are no drafts in the current filter:

- distinguish between:
  - no drafts at all for this employee
  - drafts exist, but not in the selected filters
- show a short recommended next step, for example:
  - `No drafts yet for this employee`
  - `Try clearing message filters`
  - `Employee is in campaign audience but draft generation has not produced a message yet`

Do not show a bare generic empty state when a more precise one is possible.

## Required UI Behaviour

- Keep the current employee context card in `Messages`.
- Add a secondary action on that card:
  - `Details` / `Подробнее`
- Clicking it opens the drill-down surface.
- The drill-down must work even when the employee has:
  - zero drafts
  - zero outbounds
  - zero replies
- If drafts exist, keep the existing message workflow unchanged.

## Suggested Component Shape

- `CampaignEmployeeContextCard`
- `CampaignEmployeeDetailsPanel` or `CampaignEmployeeDetailsDrawer`

It is acceptable to keep them inside the same page file if the implementation stays small, but
prefer extraction if the page starts growing again.

## Required States

- no campaign selected
- no company selected
- no employee selected
- employee selected with no drafts
- employee selected with drafts but current filters hide them
- employee selected with sent / replied history

## Important Constraints

- Do not redesign the four-column layout.
- Do not add a routing layer.
- Do not add editing of employee/company data in this task.
- Do not add sendability scoring or AI recommendations.
- Do not duplicate backend aggregation logic in the browser if existing read models already provide it.

## Acceptance Criteria

- Operators can open a lightweight drill-down for the selected employee.
- The drill-down makes it clear which email is currently usable and what activity already exists.
- Employees without drafts no longer feel like broken rows.
- Empty states in `Messages` are specific and actionable.
- Existing review / edit / trace actions for message cards remain unchanged.
