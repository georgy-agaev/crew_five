# Sessions Roadmap – crew_five

> Version: v1.3 (2026-04-01)

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

- company processing
- draft generation/review runtime
- angle formation
- ambiguous reply interpretation
- reply drafting

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

The former urgent execution-migration block is now operationally completed:

- `send-campaign` moved into `crew_five`
- auto-send intro + bump works through direct `imap-mcp`
- inbox polling + simple reply processing also now run in `crew_five`
- manual `Send now` and `Poll now` now go through `crew_five` surfaces

The next roadmap priority is:

- rolling out richer canonical generation context into the `Outreach` generation path
- formalizing the project -> offer -> hypothesis -> segment -> campaign setup workflow
- closing the bump loop with automatic bump generation + review + next-day send gate
- cleaning up remaining operator inbox / visibility gaps rather than adding another large subsystem

### Current-stage priorities

1. `send-campaign -> crew_five`
   Status: Completed
2. auto-send intro + bump scheduler
   Status: Completed
3. inbox polling + simple reply processing in `crew_five`
   Status: Completed
4. richer execution context for generation (`campaign:detail`, snapshot-derived research context, confirmed facts)
   Status: Current top priority
5. canonical campaign setup flow (`project -> offer -> icp_hypothesis -> segment -> campaign`) for
   `Outreach` handoff / wizard alignment
   Status: Current-stage priority
6. automatic bump generation + operator review + next-day send gate
   Status: Current-stage priority
7. inbox operator filtering, pagination, and campaign-linkage visibility
   Status: Current-stage priority
8. automated Playwright E2E refresh for current operator surfaces
   Status: Current-stage priority
9. campaign execution exposure / offer-aware analytics UI cleanup
   Status: Current-stage polish priority
9. processed company -> campaign wave attach
   Status: Completed
10. campaign wave composition / eligibility visibility
   Status: Completed
11. suppression and deliverability hardening
   Status: Ongoing hardening
12. operator-facing sendability/status UI
   Status: Partially completed, continue incrementally
13. minimal offer registry
   Status: Completed
14. operational `Hypothesis`
   Status: Completed
15. next-wave support
   Status: Completed
16. controlled rotation groundwork
   Status: Completed
17. multi-project foundations
   Status: Completed

### Current-stage completion snapshot

Completed in the current stage:

- import preview/apply and partial apply
- post-import company processing backend
- processed company -> campaign wave attach
- campaign launch + send preflight backbone
- campaign send policy and business-day calendar
- next-wave and controlled rotation
- offer / hypothesis / project foundations
- bounce materialization to per-email deliverability state
- `send-campaign` direct execution in `crew_five`
- `process-replies` direct polling + obvious reply handling in `crew_five`
- dashboard and current operator shell
- release/security automation for `main` and `v0.2.61` is green again (`lint`, `ast-grep`, `gitleaks`, `audit`)
- wave dedupe is hardened so next-wave creation no longer silently reuses companies already present
  in the source wave audience

Still open in the current stage:

- richer execution context for draft generation
- canonical setup flow for new project / offer / hypothesis onboarding
- automatic bump generation with review and next-day send gate
- inbox operator filtering / pagination / linkage-noise cleanup
- refreshed automated E2E for current operator surfaces
- exposure / analytics UI cleanup and stale task cleanup
- suppression hardening and related UI follow-up

### Current-stage detailed plan

See:

- [docs/private/2026-03-21_current_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_current_stage_action_plan.md)
- [docs/private/2026-03-21_backend_task_auto_send_scheduler.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_backend_task_auto_send_scheduler.md)
- [docs/private/2026-03-23_response_to_outreach_evolution_proposal.md](/Users/georgyagaev/crew_five/docs/private/2026-03-23_response_to_outreach_evolution_proposal.md)

## Next Stage – Main Goal

The next stage now starts from a different point than this roadmap originally
assumed, because several previously "next-stage" items are already shipped.

Its purpose is:

- improve generation quality with richer confirmed execution context,
- strengthen observability, setup ergonomics, and E2E confidence,
- finish the remaining operator-quality gaps around replies, analytics, and visibility,
- only then consider deeper transport/provider abstraction and broader strategy tooling.

### Next-stage priorities

1. richer execution context for generation
   Status: Next active implementation block
2. canonical setup / wizard alignment for new project + ICP onboarding
   Status: Next active implementation block
3. inbox filtering + pagination + linkage triage operator polish
   Status: Next active implementation block
4. Playwright E2E refresh for `Home`, `Campaigns`, `Builder V2`, `Inbox V2`
   Status: Next active implementation block
5. offer / exposure / analytics operator polish
   Status: Planned
6. reply-side operator workflow after obvious classification
   Status: Planned
7. direct transport adapter hardening / lifecycle polish
   Status: Partially completed (reconnect-on-ECONNRESET, restart-on-ImapFlow reuse, error hygiene); continue incrementally
8. broader generation orchestration decisions
   Status: Later

Current next-stage block status:

- active
- should focus on quality, observability, and operator usefulness rather than reopening execution migration

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
- [docs/private/2026-03-23_response_to_outreach_evolution_proposal.md](/Users/georgyagaev/crew_five/docs/private/2026-03-23_response_to_outreach_evolution_proposal.md)

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
