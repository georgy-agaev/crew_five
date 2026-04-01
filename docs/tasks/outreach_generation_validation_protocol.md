# Protocol: Outreach Generation Validation on Wave / Attach / Next-Wave

**Date:** 2026-03-25  
**Status:** Active  
**Owners:** `Outreach` + `crew_five`

## Purpose

This protocol defines how to validate the new `Outreach` generation runtime
after it switches to the canonical `crew_five` generation context.

The goal is to make the validation operational and lightweight:

- `crew_five` provides the canonical context and test scenarios
- `Outreach` integrates against that contract
- the user should only need to read and judge generated intro drafts

## Validation Scope

Validation is required on exactly three campaign scenarios:

1. `Wave`
2. `Attach`
3. `Next-wave`

These cover the three execution patterns that matter for generation quality
right now.

## Concrete Pilot Test

Use the prepared BKC pilot family as the first validation pack.

### Scenario A — Base wave

- Campaign id: `dad76931-0ef5-4144-a84a-eaa4ae759334`
- Name: `ВКС-Less-30plus-2026-03`

Expected context:

- canonical `project`
- canonical `offer`
- canonical `icp_hypothesis`
- populated `icp_profile.company_criteria`
- populated `icp_profile.persona_criteria`
- resolved `recipient_email`

Run:

- generate `3-5` intro drafts

### Scenario B — Attach validation

- Campaign id: `25eea785-7400-4e93-bd55-ed66484d8e4f`
- Name: `ВКС-Less-30plus-2026-03 - Attach Validation (canon)`

Prepared facts:

- status: `draft`
- segment snapshot matches the base wave
- manual attachments should be added via `campaign:attach-companies` (or the Attach Companies UI)
  before running generation validation

Run:

- generate `3-5` intro drafts
- at least `2` drafts must be produced for contacts with
  `audience_source = manual_attach`

### Scenario C — Next-wave

Use the same pilot family after scenarios A and B pass.

Recommended source:

- `dad76931-0ef5-4144-a84a-eaa4ae759334`

Run:

- create one fresh next-wave from the base wave through the canonical
  `crew_five` next-wave flow
- generate `3-5` intro drafts on that next-wave

If you want a pre-created canonical next-wave campaign for validation, use:

- Campaign id: `0e0aa8d8-f650-4a9f-9232-d1f61752b448`
- Name: `ВКС-Less-30plus-2026-03 - Next Wave (canon)`

Do **not** validate next-wave using the existing campaign
`ВКС-Less-30plus-2026-03 — Wave 2` (`f51361b3-83d2-47b2-92dc-92b679cc792f`):

- its audience is a strict subset of the base wave audience
- overlap check: `baseCompanies=349`, `wave2Companies=242`, `wave2Unique=0`

This makes it an invalid “fresh wave” test dataset and will waste tokens if used
for intro generation. Treat it as either:

- `Rotation` (same companies but different offer/hypothesis), or
- `Follow-up` (bump/follow-up sequence),

but not as a “new wave”.

Reason:

- this keeps next-wave validation tied to the same project / offer / hypothesis
  family instead of spreading quality review across unrelated campaigns

## Core Principle

Validation is successful only if `Outreach` generates drafts using canonical
context from `crew_five`, not local re-inference.

This means:

- use `GET /api/campaigns/:campaignId/detail` as the primary source
- do not locally guess project / offer / hypothesis / recipient if already
  present in the payload
- do not reconstruct audience provenance from heuristics

## Responsibilities

### `crew_five`

`crew_five` should handle:

- preparing the canonical `campaign:detail` contract
- exposing the test campaigns
- exposing attach-aware audience provenance
- exposing recipient resolution
- exposing exposure history
- making it easy to inspect generated drafts in Builder V2 / Campaigns

### `Outreach`

`Outreach` should handle:

- switching generation runtime to the canonical `campaign:detail` contract
- adapting prompt/runtime assembly
- generating draft batches for the three scenarios
- saving outputs back into the normal `crew_five` draft flow

### User

The user should only need to:

- open the generated intro drafts
- read them
- judge whether the messaging looks correct and non-repetitive

No manual contract inspection or transport debugging should be required from the
user for this validation pass.

## Scenarios

### 1. Wave

Definition:

- ordinary campaign wave based on the frozen segment snapshot

What must be validated:

- `project` is visible and used
- `offer` is visible and used
- `icp_profile` is visible and used
- `icp_hypothesis` is visible and used
- `recipient_email` is respected
- company description / research are visible and used

Expected behavior:

- the draft clearly reflects the project / offer / hypothesis stack
- the draft fits the company/contact context
- the recipient is correct

### 2. Attach

Definition:

- a campaign wave with companies/contacts added after the original frozen
  segment snapshot

How to prepare:

- use the current Campaign Attach Companies flow
- the current UI already supports batch attaching a group of companies selected
  through the attach surface

What must be validated:

- `companies[].employees[].audience_source = manual_attach` is consumed
- attached contacts are not ignored
- generation still uses canonical recipient context
- generation does not assume “all audience comes only from the original segment”

Expected behavior:

- attached contacts receive drafts
- the drafts are based on the attached company/contact context, not a stale
  segment-only assumption

### 3. Next-wave

Definition:

- a follow-on wave created from an earlier source wave

What must be validated:

- inherited context still resolves correctly
- exposure history is visible
- generation does not repeat weak prior framing mechanically
- recipient resolution remains correct

Expected behavior:

- the draft acknowledges a follow-on wave context where appropriate
- the draft avoids obvious repetition when exposure history is available

## Validation Steps

The protocol is designed so the user only needs to read/approve drafts.
The integration operator work should be entirely handled by `Outreach`.

### Step 0 — Confirm canonical context is present (machine check)

For each scenario campaign, fetch:

- `GET /api/campaigns/:campaignId/detail`

and assert these are non-null / populated:

- `project`
- `offer`
- `icp_profile.company_criteria`
- `icp_profile.persona_criteria`
- `icp_hypothesis`
- `companies[].employees[].recipient_email`
- `companies[].employees[].audience_source`

If any of these are missing, generation should stop and report the missing field
instead of trying to infer it locally.

### Step 1 — Generate a tiny batch and save drafts (Outreach-owned)

For each scenario:

1. load canonical context via `campaign:detail`
2. pick `3-5` sendable recipients
3. generate intro drafts using that canonical context
4. save drafts back into `crew_five` via `draft:save` (or the existing save path)

The user should not need to debug contract payloads or run CLI plumbing.

### Step 2 — Operator review (user-only action)

The user should only:

- open Builder V2
- read the intro drafts
- approve/reject as usual

No other actions should be required for validation.

### Step 3 — Attach and next-wave assertions (machine check)

#### Attach

For Scenario B, assert:

- at least one generated draft has `audience_source = manual_attach`

#### Next-wave

For Scenario C, assert:

- at least one generated draft has non-empty exposure context when available
  (`execution_exposures` / `exposure_summary`)
- generation avoids repeating the same framing when exposure history is present

Run the same sequence for all three scenarios.

### Step 1 — Contract Check

Before generation, inspect `campaign:detail`.

Required fields to confirm:

- `campaign`
- `project`
- `offer`
- `segment`
- `icp_profile`
- `icp_hypothesis`
- `companies[]`
- `companies[].employees[]`
- `recipient_email`
- `audience_source`
- `execution_exposures`
- `exposure_summary`

Pass condition:

- all required scenario-relevant fields are present and non-empty where
  expected

For the prepared BKC pilot this means:

- Scenario A must show non-null `project`, `offer`, `icp_hypothesis`
- Scenario B must show `manual_attach` audience members
- Scenario C must inherit the same project / offer / hypothesis family

### Step 2 — Generation Run

Run generation through the updated `Outreach` runtime for the target campaign.

Recommended sample size:

- 3 to 5 intro drafts per scenario

Pass condition:

- generation completes without falling back to old local inference logic

### Step 3 — Structural Output Check

Check generated drafts for:

- correct recipient
- correct contact/company identity
- correct project / offer / hypothesis separation
- correct use of attach / next-wave context

Pass condition:

- no obvious structural mismatches

### Step 4 — Human Quality Review

The user reads the generated intro drafts only.

The user should judge:

- relevance
- clarity
- non-repetition
- fit to company/contact context
- fit to the product/offer/hypothesis

Pass condition:

- drafts are acceptable for normal operator review flow

## Concrete Pass/Fail Checklist

### PASS

- `project`, `offer`, `hypothesis`, and `segment` are not conflated
- recipient comes from canonical `crew_five` resolution
- attach contacts are generated correctly
- next-wave drafts do not obviously ignore prior exposure context
- company/contact identity remains correct
- drafts are good enough for operator approval/rejection review

### FAIL

Any of the following is a failure:

- `Outreach` ignores `project` or `offer`
- `Outreach` ignores `icp_profile.company_criteria` / `persona_criteria`
- recipient is guessed incorrectly despite canonical context being present
- attached contacts are skipped or treated as if they were absent
- next-wave drafts repeat earlier messages blindly
- prompts/runtime collapse project, offer, and hypothesis into one blob

## Artifacts To Save

For each scenario, save:

1. campaign id
2. a `campaign:detail` payload sample
3. generation run id / trace if available
4. 3 to 5 produced intro drafts
5. pass/fail summary

## Minimal User Involvement

This validation should be operated by `crew_five` + `Outreach`.

The user should only need to:

- open the resulting intro drafts
- read them
- judge quality

The user should not need to:

- create projects/offers/hypotheses
- attach companies manually for the pilot
- inspect raw contract payloads
- debug transport or runtime wiring

## Recommended Order

Run in this order:

1. `Wave`
2. `Attach`
3. `Next-wave`

Reason:

- if `Wave` fails, the contract integration is not ready
- if `Wave` passes but `Attach` fails, the gap is likely audience provenance
- if `Attach` passes but `Next-wave` fails, the gap is likely exposure or
  inheritance handling

## Operational Note

This protocol is deliberately designed so that:

- `crew_five` and `Outreach` do the setup and runtime work
- the user only needs to read intro drafts and give a quality judgment

That should remain the default execution model for this validation block.
