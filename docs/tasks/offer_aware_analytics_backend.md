# Task: Offer-Aware Analytics Backend

**Date:** 2026-03-22
**Status:** Completed
**Owner:** backend / Codex

## Goal

Make execution analytics usable at the `hypothesis / offer / recipient type / sender identity`
layer so repeated waves can be judged on operational outcomes, not only raw event volume.

## Completed

- Added analytics summaries grouped by:
  - `offer`
  - `hypothesis`
  - `recipient_type`
  - `sender_identity`
- Reused canonical execution context from:
  - `email_events`
  - `email_outbound`
  - `campaigns`
  - `offers`
  - `icp_hypotheses`
- Extended CLI `analytics:summary --group-by ...` to support the new breakdowns.

## Notes

- `hypothesis` remains the primary execution lens; `offer` is a related but separate dimension.
- This is still operational analytics, not a broad BI surface.
