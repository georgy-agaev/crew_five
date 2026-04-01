# Handoff: Outreach After Execution-Layer Migration

**Date:** 2026-03-26  
**Status:** Ready (crew_five contract + pilot data prepared)  
**Owner:** Outreach

## Purpose

This handoff replaces the old assumption that `Outreach` still owns the routine
execution loop.

As of now:

- `crew_five` owns send execution
- `crew_five` owns inbox polling and obvious reply ingestion
- `Outreach` remains the intelligence layer

The immediate goal for `Outreach` is no longer transport/runtime ownership.
The immediate goal is:

- improve generation quality using richer canonical execution context from
  `crew_five`
- keep company processing strong
- keep ambiguous reply interpretation / drafting strong

## Live Transport Hardening Note (imap-mcp)

`crew_five` now runs direct `imap-mcp` transports for send + inbox polling. The adapters:

- reuse a shared MCP stdio transport per process
- perform `imap_connect` lazily per mailbox account
- reconnect and retry once on common transient mailbox errors (`ECONNRESET`, `Connection not available`)
- restart the MCP process when imap-mcp reports an unrecoverable reconnect state
  (`Failed to reconnect: Can not re-use ImapFlow instance`)
- format unknown errors to avoid `[object Object]` in scheduler logs

This reduces the amount of transport-level debugging that would otherwise leak into generation validation.
It also means transient IMAP disconnects should self-heal without the user restarting the adapter.

## Current Canonical Split

### crew_five owns

- campaign launch / launch preview
- campaign send policy
- mailbox assignment
- manual `Send now`
- auto-send intro / bump
- direct `imap-mcp` send transport
- inbox polling
- obvious reply classification / ingestion
- `email_outbound`
- `email_events`
- suppression / deliverability state
- next-wave preview / create
- rotation preview
- campaign detail / audit / analytics read models

### Outreach owns

- company processing
- draft generation
- draft review / regeneration runtime
- angle formation
- ambiguous reply interpretation
- reply drafting
- GTM reasoning and iteration

## Important Change

`Outreach` should no longer treat these as its primary runtime responsibilities:

- `send-campaign`
- `process-replies`
- poll-now execution ownership
- send-time mailbox orchestration

They may remain as temporary fallback paths only, but not as the primary
operator path.

## What Outreach Should Do Next

### Priority 1 — Richer generation context

Use `crew_five` as the canonical source of execution context when generating
drafts.

Generation should rely on explicit campaign facts rather than local inference
from names or old assumptions.

Required inputs to consume from `crew_five`:

- campaign identity and status
- project context
- offer context
- operational hypothesis context
- ICP / segment context
- frozen campaign-wave audience
- recipient email and recipient type
- company description / research / website / employee count
- employee-level contact identity and position
- prior exposure context when available

Recommended canonical source:

- `campaign:detail`

If needed, use additional `crew_five` read-model surfaces, but do not recreate
the execution spine locally.

### Priority 1 Status Update

The `crew_five` side of this contract is now ready.

`GET /api/campaigns/:campaignId/detail` already exposes the richer context that
`Outreach` should consume for generation:

- `campaign`
  - `id`, `name`, `status`, `segment_id`, `segment_version`
- `project`
  - `id`, `key`, `name`, `description`, `status`
- `offer`
  - `id`, `project_id`, `title`, `project_name`, `description`, `status`
- `segment`
  - `id`, `name`, `icp_profile_id`, `icp_hypothesis_id`
- `icp_profile`
  - `id`, `project_id`, `name`, `description`, `offering_domain`
  - `company_criteria`
  - `persona_criteria`
  - `phase_outputs`
  - `learnings`
- `icp_hypothesis`
  - `id`, `icp_id`, `name`, `offer_id`, `status`, `messaging_angle`
  - `search_config`
  - `targeting_defaults`
  - `pattern_defaults`
  - `notes`
- `companies[]`
  - `company_id`, `company_name`, `website`, `employee_count`, `region`
  - `company_description`
  - `company_research`
  - `composition_summary`, including:
    - `segment_snapshot_contacts`
    - `manual_attach_contacts`
- `companies[].employees[]`
  - `contact_id`, `full_name`, `position`
  - `work_email`, `generic_email`
  - `recipient_email`, `recipient_email_source`, `sendable`
  - `audience_source`
  - `attached_at`
  - `execution_exposures`
  - `exposure_summary`

This means `Outreach` should now adapt its runtime to the existing contract,
not wait for another `crew_five` endpoint to appear.

## Pilot Family Prepared In crew_five

`crew_five` has now prepared a concrete pilot family for `Outreach` validation.

### Canonical entities

- Project
  - `f88223b5-733e-4c3f-8e19-054538f28e3c`
  - `voicexpert-vks`
  - `VoiceXpert ВКС и переговорные`
- Offer
  - `13e71257-d4a5-4e2f-9c54-5f094f881714`
  - `Комплекты для видеоконференций в переговорные комнаты`
- Hypothesis
  - `ea28784a-24c6-4d7e-a84c-e0ec8ee2c120`
  - `Оборудование переговорных комнат для небольших компаний`

### Campaigns

- Base wave
  - `dad76931-0ef5-4144-a84a-eaa4ae759334`
  - `ВКС-Less-30plus-2026-03`
- Existing family wave
  - `f51361b3-83d2-47b2-92dc-92b679cc792f`
  - `ВКС-Less-30plus-2026-03 — Wave 2`
- Attach validation wave
  - `92d9ff82-58b6-4d09-9113-b37e0ab06d77`
  - `ВКС-Less-30plus-2026-03 — Attach Validation`

### Attach validation dataset

The attach validation wave already contains real manually attached contacts:

- attached companies: `3`
- attached contacts: `8`
- provenance: `audience_source = manual_attach`

This means `Outreach` does not need to ask the user to prepare an attach case
manually before validation starts.

### Priority 2 — Make generation attach-aware

Generation must work correctly not only for the original segment wave, but also
for:

- companies attached after import/process
- next-wave campaigns created from prior waves
- campaigns launched with explicit project / offer / hypothesis context

Do not assume:

- every campaign is only segment-derived with no additions
- every campaign lacks project / offer / hypothesis identity

### Priority 3 — Keep reply intelligence, not routine polling

For replies:

- obvious reply ingestion is now `crew_five` work
- `Outreach` should focus on:
  - ambiguous human replies
  - suggested response strategy
  - drafted response content

## Concrete Work Items For Outreach

### 1. Update draft-generation runtime to use canonical campaign context

Required:

- load project / offer / hypothesis / ICP / segment context from `crew_five`
- stop relying on local defaults or prompt-time guessing where canonical fields
  already exist
- preserve compatibility with campaigns that have explicit:
  - `project`
  - `offer`
  - `icp_hypothesis`
- treat `campaign:detail` as the default source for campaign-wave context
- treat `companies[].employees[]` as the canonical frozen/attached audience list

### 2. Update generation prompts to distinguish context layers clearly

Generation must not conflate:

- project
- offer
- hypothesis
- segment
- campaign wave

These must be treated as separate concepts in prompt construction and runtime
data preparation.

### 3. Use confirmed recipient context from crew_five

Use canonical recipient context already resolved in `crew_five`:

- recipient email
- recipient email source
- recipient email kind
- sendable status

Do not re-infer recipient selection from sparse employee fields if the campaign
detail / draft context already contains a resolved recipient.

Also use:

- `audience_source` to distinguish frozen-wave contacts from manual attachments
- `attached_at` when recency or provenance matters

### 4. Respect execution history where available

When generation context exposes prior execution information, use it to avoid
weak or repetitive content.

Examples:

- prior offer exposure
- prior campaign exposure
- prior hypothesis exposure
- prior send count / reply state when present

This should improve quality, not create a new local state model.

### 5. Keep process-companies strong and aligned

Post-import processing remains an `Outreach` responsibility.

Required:

- keep `process-companies` compatible with large async jobs from `crew_five`
- keep per-company results readable
- keep structured JSON contract stable
- keep saved company data rich enough for downstream draft generation

## What Outreach Should Explicitly Avoid

Do not spend effort on:

- reclaiming `send-campaign` ownership
- reclaiming `process-replies` ownership
- building parallel mailbox runtime orchestration as the primary path
- recomputing campaign defaults already resolved by `crew_five`
- inventing a separate campaign identity model that drifts from `crew_five`

## Suggested Validation Checklist

### Draft generation

Verify generation on campaigns that have:

1. explicit project + offer + optional hypothesis
2. attached processed companies
3. next-wave inheritance
4. recipient context already resolved by `crew_five`

### Data shape

Verify prompts/runtime can see and use:

- project name / key
- project description
- offer title / project name
- offer description
- hypothesis label / messaging angle
- hypothesis search / targeting defaults when relevant
- ICP / segment identity
- ICP `company_criteria` and `persona_criteria`
- ICP `learnings` when present
- company description / research / website
- contact name / title
- recipient email context
- audience provenance (`segment_snapshot` vs `manual_attach`)
- prior exposure context from `execution_exposures` / `exposure_summary`

### Negative checks

Verify generation does **not**:

- collapse project and offer into one concept
- collapse offer and hypothesis into one concept
- ignore attached-company audience additions
- ignore canonical recipient resolution from `crew_five`
- rebuild company/contact provenance from local heuristics
- ignore `learnings` when they are present in the ICP payload

## Recommended Order For Outreach

1. align generation runtime with canonical campaign context
2. validate generation on real waves already used in `crew_five`
3. tighten prompts only after context alignment is correct
4. leave send/reply routine runtime alone unless needed as fallback

## Short Version For Chat

```text
crew_five now owns the routine execution loop:
- send-campaign
- auto-send
- inbox polling
- obvious reply ingestion

Outreach should now focus on:
- process-companies
- draft generation / review
- ambiguous reply interpretation
- reply drafting

Immediate next task:
- make draft generation consume richer canonical campaign context from crew_five
  (project / offer / hypothesis / ICP / segment / frozen audience / recipient context)
- use the existing GET /api/campaigns/:campaignId/detail contract as the primary source
- consume audience provenance (segment_snapshot vs manual_attach) and exposure context directly
- generation must work for attached companies, next-wave campaigns, and explicit
  project-offer-hypothesis launches
- do not treat send-campaign or process-replies as primary Outreach runtime anymore
```
