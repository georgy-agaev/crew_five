# Task: Campaign Bump Review Queue Web UI

**Date:** 2026-04-01
**Status:** Done
**Owner:** frontend / web UI

## Goal

Expose the new bump auto-generation flow to the operator without hiding the critical review step.

## Required UI Behavior

The operator must be able to distinguish at a glance between:

1. bump drafts that were auto-generated and need review
2. bump drafts that were approved today but are intentionally not sendable yet
3. bump drafts that are approved and now sendable
4. bump drafts that were already sent

## Minimum Surfaces

### Campaign / Builder operator surfaces

Show:

- count of bump drafts pending review
- count of bump drafts approved today
- count of bump drafts sendable now
- count of bump drafts sent

### Draft review surface

For bump drafts, show:

- `Auto-generated` badge when applicable
- `Approved today — sendable tomorrow` badge/message when blocked by cooling rule
- canonical blocker state from backend instead of browser-side estimation

## Constraints

- Do not recreate bump eligibility logic in the browser
- Do not guess “tomorrow” from the browser clock alone
- Use canonical backend state / fields
- Reuse existing operator shell and card patterns

## Recommended UI Additions

1. small bump queue summary card on campaign surfaces
2. bump draft badges in review list/detail
3. send-preflight / sendability block that explicitly names cooling-period blockers

## Acceptance Criteria

- operator can see which bump drafts require review
- operator can see which approved bump drafts are blocked until tomorrow
- operator can see when a bump becomes sendable
- no client-side approximation of send timing is introduced
