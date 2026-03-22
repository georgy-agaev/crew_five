# Task: ICP / Hypothesis Exposure Tracking Backend

**Date:** 2026-03-22
**Status:** Completed
**Owner:** backend / Codex

## Goal

Make later wave reuse and rotation safe by adding a canonical, queryable history of which
`ICP / hypothesis / offer` execution context has already been exposed to which contact.

This should stay anchored to the existing outbound spine:

- `campaigns.offer_id`
- `drafts`
- `email_outbound`
- `email_events`

Do not introduce a speculative workflow engine or a broad BI model as part of this task.

## Problem

`crew_five` now stores canonical `offer_id` and `icp_hypothesis_id` on campaign waves, but later
wave decisions still lack explicit memory of:

- which ICP / hypothesis context a contact already saw
- which canonical offer entity was attached to that send
- in which campaign wave it happened
- when the exposure happened
- whether it resulted in reply / bounce / unsubscribe

Without that memory:

- next-wave reuse / rotation is hard to reason about
- operator context stays shallow
- future hypothesis / offer-aware analytics have to reconstruct history ad hoc

## Options

### Option 1 — New materialized exposure table

Create a dedicated `contact_offer_exposures` table and populate it on send/event ingest.

Pros:

- explicit and fast
- easy to query later

Cons:

- duplicates canonical ledger data early
- increases write-path complexity
- requires backfill rules immediately

### Option 2 — Ledger-derived exposure service

Derive offer exposure from existing canonical records:

- `email_outbound`
- `campaigns.offer_id`
- `email_events`

Pros:

- no duplicate state
- anchored to real sends, not intent
- faster to ship safely

Cons:

- some read paths need joins
- may need materialization later if scale grows

### Option 3 — Draft-derived offer history

Treat generated drafts as exposure memory.

Pros:

- earliest possible signal

Cons:

- not a real exposure
- overstates what the contact actually received
- wrong basis for rotation and deliverability decisions

## Recommended Approach

Use **Option 2**.

For now, a contact is considered exposed to an ICP / hypothesis / offer execution context only
after there is a canonical outbound send.

## Canonical Rule

Exposure history is derived from:

- `email_outbound.contact_id`
- `email_outbound.campaign_id`
- `email_outbound.sent_at`
- `campaigns.offer_id`
- `campaigns.icp_hypothesis_id`
- optional outcome events from `email_events`

The canonical hierarchy is:

- `icp_profiles`
- `icp_hypotheses` linked to ICP
- `segments` as subsets attached to hypothesis / ICP
- `campaign` as execution wave over a segment snapshot

`offer_id` is part of execution context, but not the sole identity of past exposure.

## Backend Deliverables

### 1. Exposure helper

Add a reusable backend service, for example:

- `src/services/offerExposure.ts`

Suggested surface:

- `listExecutionExposureByContact(client, contactIds)`
- `listExecutionExposureForCampaign(client, campaignId)`

Each exposure row should include at least:

- `contact_id`
- `campaign_id`
- `icp_profile_id`
- `icp_hypothesis_id`
- `offer_id`
- `offer_title`
- `project_name`
- `offering_domain`
- `offering_hash`
- `offering_summary`
- `first_sent_at`
- `last_sent_at`
- `sent_count`
- `replied`
- `bounced`
- `unsubscribed`

### Provenance rule

Do not treat canonical `offer_id` as the whole story.

`crew_five` already carries execution provenance from ICP / `Outreach` in draft/outbound metadata:

- `icp_profile_id`
- `icp_hypothesis_id`
- `offering_domain`
- `offering_hash`
- `offering_summary`

Exposure history should reuse that provenance so later operator reasoning can answer both:

- "Which ICP / hypothesis execution context was used?"
- "Which canonical offer entity was attached?"
- "What project / offering context did Outreach actually send with?"

### 2. Campaign detail integration

Extend `campaign:detail` read model so employee/contact context can surface compact execution history.

Suggested employee fields:

- `exposure_summary`
  - `total_exposures`
  - `last_icp_hypothesis_id`
  - `last_offer_id`
  - `last_offer_title`
  - `last_sent_at`
- `execution_exposures[]`
  - compact list ordered by `last_sent_at desc`

This should support future operator drill-down without adding a new endpoint yet.

### 3. Next-wave preview integration

Extend next-wave preview items with a compact explanation layer:

- `exposure_summary`

Do **not** introduce a new blocked reason in this task unless the current behavior is ambiguous.
The purpose here is memory and explainability first.

### 4. Reusable analytics groundwork

The helper should be designed so later hypothesis / offer-aware analytics can reuse it rather than
rebuilding the same joins again.

## Out of Scope

- offer rotation policy UI
- new blocked reason for same-offer cooldown
- separate exposure history endpoint
- materialized exposure table
- changing send runtime or next-wave business rules beyond explainability

## Acceptance Criteria

1. Backend can return canonical execution exposure history per contact using existing ledger tables.
2. `campaign:detail` includes compact exposure context for contacts.
3. `campaign:next-wave:preview` includes compact exposure context for candidate contacts.
4. No new duplicated persistence table is added.
5. Tests cover:
   - single execution exposure
   - multiple campaigns / multiple offers / hypotheses
   - ICP / offering provenance propagation
   - reply / bounce / unsubscribe propagation
   - campaign detail integration
   - next-wave preview integration
