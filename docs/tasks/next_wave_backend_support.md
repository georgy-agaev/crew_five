# Task: Next-Wave Backend Support

**Date:** 2026-03-21
**Status:** Completed
**Owner:** backend / Codex

## Goal

Add a canonical backend flow for creating the next frozen campaign wave from prior campaign
context, without turning campaigns into a dynamic audience system.

## Product Intent

`crew_five` should make repeated outbound waves cheaper to create while preserving:

- frozen execution waves
- clear auditability
- explicit blocked reasons
- clean handoff to `Outreach`

The new backend block should reuse what already exists:

- `offer_id`
- `icp_hypothesis_id`
- campaign send policy
- mailbox plan
- campaign audience / attach flow
- suppression and deliverability checks

## Non-Goals

- do not mutate the existing campaign wave in place
- do not auto-send the next wave immediately
- do not build automatic offer rotation logic yet
- do not introduce dynamic campaigns or rule-driven live membership

## Recommended Shape

### Option 1. Minimal clone

Add a raw `campaign:clone` that reuses campaign settings and segment only.

Pros:
- fast

Cons:
- too little operator value
- no candidate pool / exclusions
- no blocked-reason visibility

### Option 2. Recommended

Add a two-step canonical flow:

- `campaign:next-wave:preview`
- `campaign:next-wave:create`

Preview should:

- load source campaign context
- compute reusable defaults:
  - `offer_id`
  - `icp_hypothesis_id`
  - send policy
  - interaction/data-quality mode
  - mailbox plan summary
- compute next-wave audience candidates from the source segment/audience baseline
- exclude contacts that should not re-enter the next wave
- return blocked-reason counts and candidate counts

Create should:

- reuse confirmed defaults from preview/operator input
- ensure snapshot for the chosen target segment/version
- create a fresh campaign wave
- optionally persist initial mailbox assignment
- return created campaign + preview summary

### Option 3. Heavy playbook-first model

Introduce a higher-level reusable playbook entity first.

Pros:
- cleaner long-term

Cons:
- premature for the current roadmap step

## Recommended Blocked Reasons

At preview time, expose at least:

- `suppressed_contact`
- `already_contacted_recently`
- `no_sendable_email`
- `already_in_target_wave`
- `already_used_in_source_wave`

Keep these canonical and reusable across UI and `Outreach`.

## Recommended Preview Response

```json
{
  "sourceCampaign": {
    "id": "camp-1",
    "name": "Wave 1"
  },
  "defaults": {
    "offerId": "offer-1",
    "icpHypothesisId": "hyp-1",
    "sendPolicy": {
      "sendTimezone": "Europe/Moscow",
      "sendWindowStartHour": 9,
      "sendWindowEndHour": 17,
      "sendWeekdaysOnly": true
    },
    "interactionMode": "express",
    "dataQualityMode": "strict"
  },
  "summary": {
    "candidateContactCount": 42,
    "blockedContactCount": 18
  },
  "blockedBreakdown": {
    "suppressed_contact": 3,
    "already_contacted_recently": 9,
    "no_sendable_email": 4,
    "already_in_target_wave": 2
  }
}
```

## Schema Guidance

Prefer no new table in the first pass unless needed for auditability.

Start by reusing:

- `campaigns`
- `campaign_member_additions`
- `email_outbound`
- `email_events`
- `drafts`

Only add a dedicated `campaign_next_wave_runs` / similar audit table if the preview/create flow
becomes hard to reason about without one.

## Backend Files Likely Involved

- `src/services/campaignNextWave.ts`
- `src/services/campaignAudience.ts`
- `src/services/campaignDetailReadModel.ts`
- `src/services/contactSuppression.ts`
- `src/services/campaigns.ts`
- `src/services/campaignLaunch.ts`
- `src/cli.ts`
- `src/web/routes/campaignRoutes.ts`
- `src/web/liveDeps.ts`
- `src/web/types.ts`

## CLI / API Shape

Recommended CLI:

- `campaign:next-wave:preview --campaign-id <id> --error-format json`
- `campaign:next-wave:create --payload '<json>' --error-format json`

Recommended Web:

- `GET /api/campaigns/:campaignId/next-wave-preview`
- `POST /api/campaigns/next-wave`

## TDD Plan

1. Preview service tests
   - reuses offer/hypothesis/send policy defaults
   - counts blocked reasons deterministically
   - excludes suppressed / already-contacted contacts
2. Create service tests
   - creates a fresh campaign wave
   - persists optional sender plan
   - persists reused offer/hypothesis/send policy
3. CLI tests
4. Web route tests
5. Full quality gate

## Required Handoffs After Backend

- Claude:
  - next-wave preview/create UI flow
- Outreach:
  - use canonical next-wave preview/create instead of rebuilding a campaign manually

## Completed

- Added canonical backend service:
  - [campaignNextWave.ts](/Users/georgyagaev/crew_five/src/services/campaignNextWave.ts)
- Added exclusion-aware audience support:
  - [campaignAudience.ts](/Users/georgyagaev/crew_five/src/services/campaignAudience.ts)
  - [20260322000500_add_campaign_member_exclusions.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260322000500_add_campaign_member_exclusions.sql)
- Added CLI:
  - `campaign:next-wave:preview`
  - `campaign:next-wave:create`
- Added Web API:
  - `GET /api/campaigns/:campaignId/next-wave-preview`
  - `POST /api/campaigns/next-wave`
- Reused source-wave defaults:
  - `offer_id`
  - `icp_hypothesis_id`
  - send policy
  - mailbox plan
  - interaction/data-quality mode
- Materialized blocked target contacts into `campaign_member_exclusions`
- Copied eligible source manual additions into the new wave via `campaign_member_additions`
