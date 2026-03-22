# Task: Operational Hypothesis Backend

## Goal

Turn `icp_hypotheses` into reusable execution presets and let campaign waves link them canonically.

## Completed

- Added operational fields to `icp_hypotheses`:
  - `offer_id`
  - `targeting_defaults`
  - `messaging_angle`
  - `pattern_defaults`
  - `notes`
- Added `campaigns.icp_hypothesis_id`
- Extended `icp:hypothesis:create` to persist the new operational fields
- Extended `icp:hypothesis:list` to expose the new operational fields
- Extended `campaign:create` with `--icp-hypothesis-id`
- Extended `campaign:launch:preview` / `campaign:launch` payload handling with `icpHypothesisId`
- Added canonical resolution rule:
  - hypothesis-linked `offer_id` can resolve missing `offerId`
  - conflicting explicit `offerId` vs hypothesis `offer_id` is rejected with
    `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`
- Extended `campaign:detail` so campaign context now returns operational hypothesis info from the
  campaign row itself

## To Do

- Frontend hypothesis picker / campaign-context visibility
- Outreach runtime adoption in `/launch-campaign`
- Next-wave support on top of offer + hypothesis + campaign defaults
