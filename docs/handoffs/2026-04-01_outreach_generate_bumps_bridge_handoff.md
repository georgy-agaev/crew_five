# Handoff: Outreach Bump-Generation Bridge

**Date:** 2026-04-01  
**Audience:** Outreach maintainers  
**Status:** Ready for Outreach implementation

## Purpose

`crew_five` is moving to automatic bump draft generation after canonical follow-up eligibility is
reached.

`Outreach` remains the runtime that actually writes bump drafts.

This handoff defines the CLI bridge contract expected by `crew_five`.

## Target Runtime Split

`crew_five` owns:

- canonical intro/bump follow-up eligibility
- generation trigger timing
- operator review workflow
- sendability gates
- final send execution

`Outreach` owns:

- actual LLM/runtime generation of bump drafts

## Required Env On `crew_five` Side

```bash
OUTREACH_GENERATE_BUMPS_CMD=/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh
```

## Command Contract

### Required flags

- `--campaign-id <id>`
- `--dry-run`
- `--limit <n>`

### Recommended flags

- `--contact-ids '<json-array>'`
  - strongly recommended so `crew_five` can pass an exact canonical batch

### Optional compatibility flags

The script must not break if `crew_five` later passes extra generation context flags similar to
intro generation.

## Behavioral Rules

### 1. `--dry-run` must be non-destructive

Preview mode must:

- not create drafts
- not change statuses
- not mutate campaign state

### 2. Real mode must persist bump drafts

Real mode must:

- create bump drafts in the normal `drafts` table / current runtime flow
- mark them as `email_type = bump`

### 3. Idempotency must be respected

If `crew_five` calls the bridge for a contact that already has an active bump draft:

- do not create duplicates
- count the contact as `skipped`

### 4. Final stdout line must be canonical JSON

Minimum required shape:

```json
{
  "generated": 3,
  "dryRun": false,
  "failed": 0,
  "skipped": 0
}
```

Recommended extended shape:

```json
{
  "generated": 3,
  "dryRun": false,
  "failed": 0,
  "skipped": 2,
  "error": null
}
```

## Recommended Invocation Shape

Preview:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh \
  --campaign-id 'campaign-uuid' \
  --dry-run \
  --limit 20 \
  --contact-ids '["contact-1","contact-2"]'
```

Real run:

```bash
/Users/georgyagaev/Projects/Outreach/scripts/generate_bumps_cli.sh \
  --campaign-id 'campaign-uuid' \
  --limit 20 \
  --contact-ids '["contact-1","contact-2"]'
```

## Why `--contact-ids` Is Recommended

Without `--contact-ids`, `Outreach` would have to re-decide which contacts deserve bump generation.

That is the wrong boundary.

`crew_five` should decide:

- who is canonically eligible
- who is blocked
- who should be generated now

`Outreach` should generate drafts only for the contacts it is explicitly asked to process.

## Acceptance Criteria For Outreach

- supports `--campaign-id`
- supports `--dry-run`
- supports `--limit`
- preferably supports `--contact-ids`
- emits canonical final JSON
- does not create duplicate bump drafts for the same contact/campaign
