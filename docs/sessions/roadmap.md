# Sessions Roadmap – crew_five

> Version: v0.9 (2026-03-22)

> This roadmap reflects the current agreed direction for `crew_five` after the
> recent integration work with `Outreach` and the revised product model. It
> replaces the older phase-based roadmap as the operational guide for new work.

## Purpose

This document should tell a contributor:

- what `crew_five` is trying to become right now,
- what should be built next,
- what should explicitly not dominate the near-term roadmap,
- how the current and next stages relate to each other.

Detailed strategic discussion lives in private docs, but this file should stay
accurate enough for general roadmap orientation.

## Product Direction

`crew_five` is currently being developed as a:

**semi-automated outbound operating assistant**

not as:

- a broad GTM platform,
- a fully autonomous AI SDR,
- or a replacement for all strategy/runtime systems around it.

The near-term objective is practical:

- reduce routine quickly,
- make the weekly/monthly outbound loop work asynchronously,
- keep humans on real replies and strategy decisions,
- and grow sophistication later.

## Role Split

### Marketing2025

Primary role:

- offer ideas
- positioning
- messaging concepts
- marketing learnings

### Outreach

Primary role:

- runtime execution
- company processing
- draft generation/review/send runtime
- mailbox polling
- reply classification

### crew_five

Primary role:

- canonical outbound system of record
- operator workflow
- campaign waves
- offers and hypotheses actually used in execution
- events/outbounds
- suppression and deliverability state
- execution analytics
- async integration contracts around `Outreach`

## Current Product Model

For the current stage, use:

- `Offer` = business proposition
- `Hypothesis` = targeting + messaging preset
- `Campaign wave` = frozen execution snapshot

Do **not** switch to fully dynamic campaigns yet.

Frozen campaign waves are still the recommended execution model because they are:

- easier to audit,
- easier to reason about,
- safer for early automation,
- and better matched to the current operator workflow.

## Current Project Position

`crew_five` is already beyond the foundation stage.

The system already has:

- import preview/apply
- partial apply
- post-import company processing
- campaign launch and send preflight
- mailbox assignment
- inbox poll trigger and scheduler
- canonical reply ingestion
- handled/unhandled inbox queue
- bounced-email materialization
- dashboard
- new operator web surfaces

The main roadmap question is no longer:

- "What other modules should we add?"

It is now:

- "How do we remove more routine from the real outbound loop?"

## Current Stage – Main Goal

The current stage is about making the real operator loop reliably usable:

- import
- process
- attach to campaign wave
- generate drafts
- review drafts
- send
- poll replies
- work inbox

### Urgent current priority

Because live campaigns already exist and the main pain is manual send
supervision, the most urgent current block is:

- automatic scheduled sending of approved intro and eligible bump drafts

This should currently outrank broader ergonomics work because it removes
day-to-day operator babysitting from already live campaigns.

### Current-stage priorities

1. auto-send intro + bump scheduler
   Status: Completed
2. processed company -> campaign wave attach
   Status: Completed
3. campaign wave composition / eligibility visibility
   Status: Completed
4. suppression and deliverability hardening
   Status: Completed
5. operator-facing sendability/status UI
   Status: Completed
6. minimal offer registry
   Status: Completed
7. operational `Hypothesis`
   Status: Completed
8. next-wave support
   Status: Completed

### Current-stage completion snapshot

Completed in the current stage:

- auto-send intro + bump scheduler
- processed company -> campaign wave attach
- campaign wave composition / eligibility visibility
- suppression and deliverability hardening
- operator-facing sendability/status UI
- minimal offer registry
- operational `Hypothesis`

Still open in the current stage:

- none

### Current-stage detailed plan

See:

- [docs/private/2026-03-21_current_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_current_stage_action_plan.md)
- [docs/private/2026-03-21_backend_task_auto_send_scheduler.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_backend_task_auto_send_scheduler.md)

## Next Stage – Main Goal

The next stage starts after the current operator loop is stable enough in real
use.

Its purpose is:

- make repeated waves easier,
- make `Offer` and `Hypothesis` first-class operational objects,
- support next-wave creation,
- prepare controlled offer rotation later.

### Next-stage priorities

1. offer registry hardening
   Status: Completed
2. offer management UI
   Status: Completed (minimal operator shape)
3. hypothesis operationalization
   Status: Completed
4. hypothesis-aware campaign creation
   Status: Completed
5. next-wave backend support
   Status: Completed
6. next-wave operator flow
   Status: Completed
7. offer history / exposure tracking
   Status: Completed
8. offer-aware analytics
   Status: Completed
9. controlled rotation groundwork
   Status: Completed
10. multi-project foundations
   Status: Completed

Current next-stage block status:

- Completed through `multi-project foundations`
- Next backend priority: TBD in the next planning cycle

### Next-stage detailed plan

See:

- [docs/private/2026-03-21_next_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_next_stage_action_plan.md)

## Deferred / Lower Priority

The following should not dominate the near-term roadmap:

- fully dynamic campaigns
- SIM-heavy productization
- heavy judge / prompt-lab systems
- broad autonomous reply handling
- overbuilt analytics dashboards
- large UI redesigns not tied to routine removal
- duplicating `Outreach` runtime inside `crew_five`

## Source Adapters / Intake

Keep these as valid options:

- EXA Websets
- Anysite

But treat them as optional intake channels, especially for non-RF markets, not
as the main orchestration center of the current stage.

They should plug into the same canonical flow:

- intake -> import/apply -> process -> attach -> draft -> send -> poll -> inbox

## Practical Planning Rule

For the next development window, prioritize any change that:

- removes routine from the real operator loop within 2-8 weeks,
- strengthens canonical execution state,
- improves asynchronous operation,
- wraps `Outreach` cleanly instead of duplicating it.

Deprioritize any change that:

- broadens platform scope without helping live operation,
- adds abstraction before it removes work,
- or introduces autonomy faster than the current process can safely absorb.

## Recommended Reading

For implementation planning:

- [docs/private/2026-03-21_outreach_capability_matrix.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_outreach_capability_matrix.md)
- [docs/private/2026-03-20_backend_roadmap_v1.md](/Users/georgyagaev/crew_five/docs/private/2026-03-20_backend_roadmap_v1.md)
- [docs/private/2026-03-21_current_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_current_stage_action_plan.md)
- [docs/private/2026-03-21_next_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_next_stage_action_plan.md)

For strategy context:

- [docs/private/2026-03-19_outbound_automation_strategy.md](/Users/georgyagaev/crew_five/docs/private/2026-03-19_outbound_automation_strategy.md)
- [docs/private/2026-03-19_revised_roadmap_discussion.md](/Users/georgyagaev/crew_five/docs/private/2026-03-19_revised_roadmap_discussion.md)

## Historical Note

The older phase-based roadmap was useful during the foundation period, but the
project has now moved into a different planning mode.

Historical execution details remain in:

- `docs/sessions/YYYY-MM-DD_<n>_<slug>.md`

This roadmap should now be treated as the current navigation layer, not as a
full historical ledger.
