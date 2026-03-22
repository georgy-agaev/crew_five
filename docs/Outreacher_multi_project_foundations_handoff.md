# Handoff: Outreach Multi-Project Foundations

**Date:** 2026-03-22
**Owner:** Outreach

## What Is Ready In `crew_five`

- canonical project registry:
  - `project:list`
  - `project:create`
  - `project:update`
- project-aware offer registry
- project-aware campaign create / launch
- project-aware hypothesis consistency checks

## Canonical Rule

`project` is not a replacement for ICP.

Keep this hierarchy explicit:

- project = business/workspace boundary
- ICP = targeting root
- hypothesis = execution preset under ICP
- segment = subset of the hypothesis / ICP audience
- campaign = wave over that subset

## Recommended Runtime Flow

1. Resolve or create `projectId`
2. Resolve or create ICP root with explicit `projectId`
3. Resolve or create `offerId` under that project when relevant
4. Resolve or create `icpHypothesisId`
5. Launch campaign with explicit `projectId`

## CLI Surface

- `pnpm cli project:list --error-format json`
- `pnpm cli project:create --key <key> --name <name> [--description <text>] [--status active|inactive] --error-format json`
- `pnpm cli project:update --project-id <projectId> [--name <name>] [--description <text>] [--status active|inactive] --error-format json`
- `pnpm cli icp:create --name "<name>" [--project-id <projectId>] ...`
- `pnpm cli offer:create [--project-id <projectId>] ...`
- `pnpm cli offer:update --offer-id <offerId> [--project-id <projectId>] ...`
- `pnpm cli campaign:create ... [--project-id <projectId>] ...`

## Important Validation

- `ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH`
- `CAMPAIGN_PROJECT_MISMATCH`

If these appear, do not retry blindly. Treat them as canonical consistency failures.
