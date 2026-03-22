# Task: Add rejection-reason analytics for draft review

## Status

Completed on 2026-03-18.

## Context

`Campaigns` review now persists structured reject metadata inside `drafts.metadata`:

- `review_reason_code`
- `review_reason_codes`
- `review_reason_text`
- `review_surface`
- `reviewed_at`
- `reviewed_by`

The next analytics phase should make these review outcomes queryable so operators can understand:

- which rejection reasons are most common
- which `draft_pattern` values produce the most rejected drafts
- which campaigns / ICPs / hypotheses create the most review friction
- whether certain reasons cluster around `intro` vs `bump`

## Why

Today the metadata is stored correctly, but there is no analytics surface that answers:

- “Which review issues dominate this campaign?”
- “Which patterns keep producing `marketing_tone` or `too_generic` rejections?”
- “Are certain offers, personas, or prompt patterns causing repeat rejection reasons?”

Without this, review feedback stays local to individual drafts and does not improve pattern selection,
offer positioning, or prompt tuning.

## Scope

Add rejection-reason analytics on top of the current draft metadata model.

## Recommended path

### Phase 1: Query support

Extend analytics helpers so rejection metadata can be grouped and counted by:

- `review_reason_code`
- `draft_pattern`
- `campaign_id`
- `icp_profile_id`
- `icp_hypothesis_id`
- `email_type`

### Phase 2: CLI summary

Expose a CLI read path for rejection analytics, either by:

1. extending `analytics:summary`
2. adding a dedicated `analytics:review-reasons`
3. adding a focused `analytics:summary --group-by review_reason`

Recommended option: `analytics:summary --group-by review_reason`

### Phase 3: Web analytics

Add grouped read models / UI views for:

- top rejection reasons
- top `draft_pattern x review_reason_code` combinations
- campaign-level rejection breakdown
- `intro` vs `bump` rejection breakdown

## Minimum useful outputs

At minimum, analytics should answer:

1. Count of rejected drafts by `review_reason_code`
2. Count of rejected drafts by `draft_pattern`
3. Count of rejected drafts by `draft_pattern + review_reason_code`
4. Count of rejected drafts by `campaign_id`
5. Count of rejected drafts by `email_type`

## Suggested implementation options

1. Query directly from `drafts.metadata`
   - Fastest
   - No migration
   - More JSON extraction in SQL/helpers

2. Add a SQL analytics view that flattens review metadata
   - Best balance
   - Keeps runtime queries simpler
   - Reuses the existing analytics pattern already used elsewhere

3. Add a dedicated review events table later
   - Best audit/history model
   - More work
   - Not required for the first analytics pass

Recommended option now: `2`

## Acceptance criteria

- Analytics can group rejected drafts by `review_reason_code`
- Analytics can group rejected drafts by `draft_pattern + review_reason_code`
- CLI returns stable JSON for rejection-reason analytics
- Web/UI consumers can fetch grouped rejection analytics from a documented endpoint
- Documentation explains that these analytics are based on `drafts.metadata` review fields

## What shipped

- `analytics:summary --group-by rejection_reason` remains stable and now reuses the shared rejection breakdown helper
- Added service-level rejection breakdowns in `src/services/analytics.ts`:
  - `by_reason`
  - `by_pattern`
  - `by_pattern_and_reason`
  - `by_campaign`
  - `by_email_type`
  - `by_icp_profile`
  - `by_icp_hypothesis`
- Added web endpoint `GET /api/analytics/rejection-reasons`
- Fixed web live deps so `/api/analytics/summary` now also supports `groupBy=rejection_reason|offering` instead of silently falling back to `icp`
- Added regression coverage in:
  - `src/services/analytics.test.ts`
  - `src/web/server.test.ts`

## Dependencies

- Existing review metadata persistence in `Campaigns`
- Existing analytics service / CLI / web adapter infrastructure

## Out of scope

- Immutable review audit history
- Reviewer productivity scoring
- Automated rewrite suggestions based on rejection reasons

Those can come later after the first analytics cut is live.
