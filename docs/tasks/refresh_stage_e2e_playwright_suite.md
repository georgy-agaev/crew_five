# Task: Refresh Stage E2E Playwright Suite

**Date:** 2026-03-22
**Status:** To Do
**Owner:** shared

## Problem

The current `web/e2e` Playwright suite still targets the old segment/discovery workflow:

- `segment-filter-based.spec.ts`
- `segment-exa-search.spec.ts`
- `segment-enrichment.spec.ts`

It does not cover the current stage-closeout operator surfaces:

- `Campaigns`
- `Builder V2`
- `Launch`
- `Send preflight`
- `Next wave`
- `Rotation`
- analytics grouping checks

After `Home` became the default entrypoint, this suite drift became more visible: the tests still
assume the old pipeline is the default app path and still target legacy workflow controls.

## Goal

Replace or extend the current Playwright suite so the automated E2E gate matches the actual
stage-closeout checklist.

## Required Coverage

1. `Campaigns` operator context
   - select campaign
   - verify send preflight card
   - verify send policy block
   - verify company list
   - verify employee drill-down
   - verify offer / hypothesis / project context

2. `Builder V2`
   - open `Next wave`
   - verify blocked breakdown / reused defaults
   - open `Rotation`
   - verify candidate summary renders without server errors

3. Launch flow
   - open launch drawer
   - choose/create project
   - choose/create offer
   - optional hypothesis
   - explicit send policy confirmation
   - sender plan

4. Analytics
   - verify group-by selectors for:
     - `offer`
     - `hypothesis`
     - `recipient_type`
     - `sender_identity`

## Notes

- The old segment/discovery specs may stay as a separate legacy suite, but they should not be
  treated as the stage-closeout gate for the current operator workflow.
- Prefer stable selectors based on current operator surfaces, not legacy assumptions about the
  default entrypoint.
