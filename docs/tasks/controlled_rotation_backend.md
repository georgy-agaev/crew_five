# Task: Controlled Rotation Groundwork Backend

**Date:** 2026-03-22
**Status:** Done
**Owner:** backend / Codex

## Goal

Add a canonical preview-only backend surface for safe offer rotation decisioning.

This is not an auto-send system and not a workflow engine.

The first version should answer:

- which next offers / hypotheses are even candidates for this wave
- which contacts are eligible for those candidates
- which contacts are blocked and why

## Product Rules

Rotation must stay anchored to the current execution hierarchy:

- ICP profile
- ICP hypothesis
- segment subset
- campaign wave
- offer / offering execution context

Do not treat `offer_id` alone as the only identity.

## Recommended Surface

- `campaign:rotation:preview`
- `GET /api/campaigns/:campaignId/rotation-preview`

## Minimal Decision Rules

Global stop rules per contact:

- `reply_received_stop`
- `suppressed_contact`
- `cooldown_active`
- `no_sendable_email`

Candidate-specific rule:

- `already_received_candidate_offer`

## Candidate Set

Use active hypotheses under the same ICP profile as the source wave.

Exclude:

- the current source offer
- hypotheses without an `offer_id`
- non-active hypotheses

## Expected Output

1. Source campaign context:
   - `campaignId`
   - `offerId`
   - `icpHypothesisId`
   - `icpProfileId`
2. Candidate hypothesis / offer pairs:
   - counts of eligible / blocked contacts
   - blocked breakdown
3. Contact-level preview:
   - recipient resolution
   - compact exposure summary
   - global stop reasons
   - candidate-specific eligibility / blocked reason

## Out of Scope

- automatic rotation execution
- campaign creation from rotation preview
- cooldown UI editing
- offer prioritization ML / scoring

## Acceptance Criteria

1. Backend can preview next-offer eligibility for a source campaign.
2. Preview respects reply stop, suppression, cooldown, and no-email gates.
3. Preview uses same-ICP active hypotheses as the candidate pool.
4. Candidate offers already received by a contact are blocked explicitly.
5. CLI and web route expose the same canonical preview.

## Completed

- Added preview-only backend service:
  [campaignRotation.ts](/Users/georgyagaev/crew_five/src/services/campaignRotation.ts)
- Added canonical CLI:
  - `campaign:rotation:preview`
- Added canonical web route:
  - `GET /api/campaigns/:campaignId/rotation-preview`
- Rotation preview now reuses `campaign:detail` as the source audience/context layer and keeps
  `ICP -> hypothesis -> offer` identity intact.
