# Handoff: Outreach Generation (Priority 1) After Execution-Layer Migration

**Date:** 2026-03-27  
**Audience:** Outreach maintainers  
**Status:** Draft-ready (intended to be handed off after crew_five mail polling is stable)

## Summary

`crew_five` now owns the routine execution loop:

- send execution (manual + auto-send intro/bump)
- inbox polling (imap-mcp) and obvious reply ingestion into `email_events`
- operator web surfaces for sendability, ledger, inbox, and policy

`Outreach` remains the intelligence layer:

- company processing
- draft generation / review / regeneration runtime
- angle formation
- ambiguous reply interpretation and reply drafting

The next integration task for Outreach is **generation quality on canonical context**.

## Non-Negotiable Rule

When generating drafts, treat `crew_five` as the canonical source of campaign-wave context.

If a field is present in the canonical payload, **do not re-infer it locally**.

Primary source:

- `GET /api/campaigns/:campaignId/detail`

## What Outreach Must Consume From `campaign:detail`

Outreach generation runtime must rely on:

- `project` (identity + narrative)
- `offer` (title/description + project linkage)
- `icp_profile` with structured fields:
  - `company_criteria`
  - `persona_criteria`
  - `learnings` (when present)
- `icp_hypothesis` (label + messaging angle + defaults)
- canonical audience list:
  - `companies[].employees[]`
  - `recipient_email`, `sendable`, `recipient_email_source`
  - `audience_source` (`segment_snapshot` vs `manual_attach`)
  - exposure context (`execution_exposures`, `exposure_summary`) when available

## What Outreach Must Avoid

Do not reintroduce these as primary paths:

- `send-campaign`
- `process-replies`
- mailbox orchestration / rate limiting logic

Those live in `crew_five` now.

## Validation Protocol (Wave / Attach / Next-wave)

The validation goal is operational and lightweight:

- Outreach runs generation using canonical context
- the user only reads and approves intro drafts

Protocol doc:

- [outreach_generation_validation_protocol.md](/Users/georgyagaev/crew_five/docs/tasks/outreach_generation_validation_protocol.md)

### Test pack (pilot family)

Use the prepared BKC pilot family:

1. Base wave (Wave)
   - Campaign id: `dad76931-0ef5-4144-a84a-eaa4ae759334`
   - Name: `ВКС-Less-30plus-2026-03`
2. Attach validation wave (Attach)
   - Campaign id: `92d9ff82-58b6-4d09-9113-b37e0ab06d77`
   - Name: `ВКС-Less-30plus-2026-03 — Attach Validation`
3. Next-wave (Next-wave)
   - Create a next-wave from the base wave using crew_five next-wave flow

Pilot activation brief:

- [bkc_generation_pilot_activation_brief.md](/Users/georgyagaev/crew_five/docs/tasks/bkc_generation_pilot_activation_brief.md)

## Machine Check Before Generation

For each scenario campaign, fetch `campaign:detail` and assert non-null:

- `project`
- `offer`
- `icp_profile.company_criteria`
- `icp_profile.persona_criteria`
- `icp_hypothesis`
- `companies[].employees[].recipient_email`
- `companies[].employees[].audience_source`

If any of these are missing, generation should **stop** and report the missing field rather than
trying to invent it locally.

## Expected Operator Workload

The user should only need to:

- open Builder V2
- read generated intro drafts
- approve/reject

No CLI plumbing, transport debugging, or contract inspection should be required from the user.

