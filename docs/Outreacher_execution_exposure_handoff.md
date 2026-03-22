# Handoff: Execution Exposure Memory for Outreach

**Date:** 2026-03-22
**Status:** Active

## What Changed

`crew_five` now exposes canonical historical execution memory derived from outbound ledger rows.

This is not just `offer_id`.

It includes:

- `icp_profile_id`
- `icp_hypothesis_id`
- `offer_id`
- `offer_title`
- `project_name`
- `offering_domain`
- `offering_hash`
- `offering_summary`
- touch timestamps and outcome flags

## Available Surfaces

### `campaign:detail`

Each employee now includes:

- `exposure_summary`
- `execution_exposures[]`

### `campaign:next-wave:preview`

Each candidate item now includes:

- `exposure_summary`

## Canonical Meaning

Execution exposure should be interpreted in this hierarchy:

- ICP profile
- ICP hypothesis
- segment subset
- campaign wave
- attached offer / project context

Use this memory for explainability and future rotation decisions.

Do not reduce it to `offer_id` only.
