# Task: Bump Auto-Generation Program

**Date:** 2026-04-01
**Status:** Planned
**Owner:** coordinated package (`crew_five` backend + web, `Outreach`, operator workflow)

## Context

Current bump automation is only half-complete:

- `crew_five` already knows when a contact becomes canonically eligible for bump
- `crew_five` can already auto-send approved eligible bump drafts
- but bump drafts are **not** generated automatically

That leaves the operator with an incomplete loop:

1. intro is sent
2. contact becomes eligible for follow-up
3. operator still has to remember to trigger bump generation manually

This is operationally weak because the trigger to create the bump is exactly the part the system
already understands best:

- intro sent date
- elapsed / business-day delay
- no reply
- no bounce
- no unsubscribe
- bump not already sent

## Target Behavior

The agreed target flow is:

1. `crew_five` detects canonical bump eligibility automatically
2. `crew_five` automatically requests/generates bump drafts
3. generated bump drafts appear in operator review
4. operator approves or rejects them
5. even after approval, bump drafts become sendable **only on the next local campaign day**
6. existing bump auto-send can then deliver them

In short:

- **auto-generate**
- **human review**
- **send tomorrow, not today**

## Options Considered

### Option 1 - Keep bump fully manual

- operator manually triggers bump generation
- operator manually approves
- scheduler sends later

Pros:

- lowest implementation cost
- lowest automation risk

Cons:

- easy to forget
- weak operator loop
- does not remove routine from the workflow

### Option 2 - Full auto (generate + approve + send)

- system generates bump
- system approves/sends without operator checkpoint

Pros:

- maximum automation
- minimum operator clicks

Cons:

- too risky for current stage
- weak content quality control
- weak reputational safety

### Option 3 - Auto-generate + manual review + next-day send

- system generates the bump draft automatically
- operator reviews and approves/rejects
- approved bump waits until the next eligible day before auto-send

Pros:

- removes routine generation trigger
- preserves operator control
- prevents same-day accidental send after approval
- best fit for current stage

Cons:

- requires backend + UI + Outreach coordination

## Decision

Take **Option 3**.

## Scope Split

### `crew_five` backend

Must own:

- canonical bump-generation eligibility
- idempotent auto-generation scheduler/job
- next-day-after-approval send gate
- canonical read models for operator UI

### `crew_five` web UI

Must expose:

- bump review queue visibility
- `auto-generated` / `sendable tomorrow` signals
- clear separation between generated, approved-today, approved-sendable, sent

### `Outreach`

Must own:

- actual bump draft generation runtime
- command bridge for preview / real generation
- safe idempotent handling for batch bump generation requests

### Operator

Must get:

- a predictable review protocol
- a clear rule that approval today means earliest send tomorrow
- a validation checklist for the first live campaign

## Workstreams

1. Backend task:
   [campaign_bump_auto_generation_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_bump_auto_generation_backend.md)
2. Frontend task:
   [campaign_bump_review_queue_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_bump_review_queue_web_ui.md)
3. Outreach handoff:
   [2026-04-01_outreach_generate_bumps_bridge_handoff.md](/Users/georgyagaev/crew_five/docs/handoffs/2026-04-01_outreach_generate_bumps_bridge_handoff.md)
4. Operator protocol:
   [2026-04-01_operator_bump_validation_protocol.md](/Users/georgyagaev/crew_five/docs/handoffs/2026-04-01_operator_bump_validation_protocol.md)

## Global Acceptance Criteria

The program is complete when all of the following are true:

1. a contact with a sent intro and no response becomes a canonical bump-generation candidate
2. the system automatically generates a bump draft without operator trigger
3. the draft is visible as a reviewable bump draft in operator UI
4. approving the draft today does **not** make it sendable today
5. the same draft becomes sendable on the next eligible local day
6. if a reply/bounce/unsubscribe arrives before send, the bump does not send
7. duplicate bump generation for the same campaign/contact is blocked

## Out Of Scope

- full auto-approve of bump drafts
- full auto-send on the same day as approval
- third-email / multi-follow-up sequencing
- AI-based autonomous bump approval
