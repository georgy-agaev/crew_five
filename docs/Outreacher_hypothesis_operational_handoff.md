# Outreacher Handoff: Operational Hypothesis

## What Changed

`crew_five` now treats `icp_hypotheses` as reusable execution presets, not only discovery objects.

New canonical fields on `icp_hypotheses`:

- `offer_id`
- `targeting_defaults`
- `messaging_angle`
- `pattern_defaults`
- `notes`

Campaign waves now support:

- `campaigns.icp_hypothesis_id`

## CLI Surface

- `pnpm cli icp:hypothesis:list --error-format json`
- `pnpm cli icp:hypothesis:create --icp-profile-id <id> --label "<label>" [--offer-id <offerId>] [--targeting-defaults '<json>'] [--messaging-angle "<text>"] [--pattern-defaults '<json>'] [--notes "<text>"] [--error-format json]`
- `pnpm cli campaign:create --name "<name>" --segment-id <segmentId> [--offer-id <offerId>] [--icp-hypothesis-id <hypothesisId>] --snapshot-mode refresh --error-format json`

`campaign:launch:preview` and `campaign:launch` now also accept `icpHypothesisId` inside payload.

## Canonical Rules

- `offer` = business proposition
- `hypothesis` = targeting + messaging preset
- `campaign wave` = frozen execution snapshot that may link both

If a selected hypothesis has `offer_id`:

- and launch/create omits `offerId`, backend resolves campaign `offer_id` from the hypothesis
- and both are provided but disagree, backend rejects the request with
  `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`

## Recommended Outreach Flow

1. `offer:list`
2. `icp:hypothesis:list`
3. choose `offerId`
4. choose optional `hypothesisId`
5. pass both into:
   - `campaign:launch:preview`
   - `campaign:launch`

## Do Not Do

- Do not keep hypothesis identity only in slash-command memory.
- Do not infer campaign-local hypothesis from segment context after launch.
- Do not silently override a hypothesis-linked offer with a different offer at runtime.
