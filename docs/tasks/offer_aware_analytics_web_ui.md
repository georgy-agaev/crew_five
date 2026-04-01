# Task: Offer-Aware Analytics Web UI

**Date:** 2026-03-22
**Status:** Done
**Owner:** frontend / Claude

## Goal

Expose the new execution analytics dimensions in compact operator-facing analytics UI.

## Completion Note

This task was completed in the Stage Closeout pass. Remaining work in this area
is operator polish and cleanup, not missing offer-aware analytics support.

## Backend Ready

CLI / service now supports:

- `analytics:summary --group-by offer`
- `analytics:summary --group-by hypothesis`
- `analytics:summary --group-by recipient_type`
- `analytics:summary --group-by sender_identity`

## Required UI Work

1. Add analytics grouping options:
   - offer
   - hypothesis
   - recipient type
   - sender identity
2. Keep `offer` and `hypothesis` visibly separate.
3. Render labels/operator-friendly titles when available:
   - `offer_title`
   - `project_name`
   - `hypothesis_label`
4. Do not expand this into a new giant dashboard.

## Out of Scope

- controlled rotation logic
- experimentation platform
- cross-project BI
