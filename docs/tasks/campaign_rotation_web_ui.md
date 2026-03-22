# Task: Campaign Rotation Preview Web UI

**Date:** 2026-03-22
**Status:** Done
**Owner:** frontend / Claude

## Context

`crew_five` now exposes a canonical preview-only rotation surface:

- `GET /api/campaigns/:campaignId/rotation-preview`

This is groundwork for controlled offer rotation, not auto-send and not wave creation.

## Goal

Add a compact operator-facing rotation preview to existing campaign surfaces.

The UI should answer:

- what alternative hypotheses / offers are candidates for this campaign
- how many contacts are eligible vs blocked for each candidate
- why contacts are blocked

## Backend Ready

`rotation-preview` returns:

1. `sourceCampaign`
   - `campaignId`
   - `campaignName`
   - `offerId`
   - `offerTitle`
   - `icpHypothesisId`
   - `icpHypothesisLabel`
   - `icpProfileId`
   - `icpProfileName`
2. `summary`
   - `sourceContactCount`
   - `candidateCount`
   - `eligibleCandidateContactCount`
   - `blockedCandidateContactCount`
3. `candidates[]`
   - `icpHypothesisId`
   - `hypothesisLabel`
   - `messagingAngle`
   - `offerId`
   - `offerTitle`
   - `projectName`
   - `eligibleContactCount`
   - `blockedContactCount`
   - `blockedBreakdown`
4. `contacts[]`
   - `contactId`
   - `companyId`
   - `companyName`
   - `fullName`
   - `position`
   - `recipientEmail`
   - `recipientEmailSource`
   - `sendable`
   - `exposureSummary`
   - `globalBlockedReasons[]`
   - `candidateEvaluations[]`

## Required UI Work

1. Add a compact `Rotation` action to existing campaign operator surfaces.
2. Load and render `rotation-preview` without creating a new route.
3. Show candidate rows first:
   - offer title
   - hypothesis label
   - messaging angle
   - eligible / blocked counts
4. Show blocked breakdown chips per candidate:
   - `reply_received_stop`
   - `suppressed_contact`
   - `cooldown_active`
   - `no_sendable_email`
   - `already_received_candidate_offer`
5. Add an expandable contact drill-down:
   - global stop reasons separate from candidate-specific reasons
   - reuse existing compact exposure rendering patterns where possible

## UX Constraints

- Extend existing Campaigns / Builder V2 operator surfaces.
- Do not create a new page or dashboard.
- Keep `offer`, `hypothesis`, and historical `offering_*` concepts separate.
- Rotation preview should feel like an operator decision aid, not analytics clutter.

## Out of Scope

- creating a rotated campaign
- editing cooldown policy
- ranking candidates with scoring / ML
- bulk override actions
