# Outreacher Handoff: Minimal Offer Registry

`crew_five` now has a canonical minimal offer registry.

## What Exists

- Table: `offers`
- Campaign link: `campaigns.offer_id`
- CLI:
  - `offer:list`
  - `offer:create`
  - `offer:update`
- Launch/create support:
  - `campaign:create --offer-id <offerId>`
  - `campaign:launch:preview` accepts `offerId`
  - `campaign:launch` accepts `offerId`

## Recommended Outreacher Behavior

1. Use `offer:list` to load existing active offers.
2. If no suitable offer exists, create one with `offer:create`.
3. Pass explicit `offerId` into:
   - `campaign:launch:preview`
   - `campaign:launch`
4. If using low-level raw creation, pass `--offer-id` into `campaign:create`.

## Why This Matters

- offer identity is now campaign-local canonical state, not only `Outreach` runtime memory
- future Web UI and analytics can group by the same offer id
- campaigns no longer need to infer offer intent from free-text summaries alone

## Practical CLI Examples

List:

```bash
pnpm cli offer:list --status active --error-format json
```

Create:

```bash
pnpm cli offer:create \
  --title "Negotiation room audit" \
  --project-name "VoiceXpert" \
  --description "Audit offer" \
  --status active \
  --error-format json
```

Launch preview:

```bash
pnpm cli campaign:launch:preview \
  --payload '{"name":"Q2 Negotiation Rooms","segmentId":"seg-uuid","segmentVersion":1,"offerId":"offer-1","snapshotMode":"reuse"}' \
  --error-format json
```

Launch:

```bash
pnpm cli campaign:launch \
  --payload '{"name":"Q2 Negotiation Rooms","segmentId":"seg-uuid","segmentVersion":1,"offerId":"offer-1","snapshotMode":"reuse","createdBy":"outreacher"}' \
  --error-format json
```

## Boundary

- `crew_five` owns canonical persistence of offers and `campaign.offer_id`
- `Outreach` owns choosing which offer to use for a given campaign
- do not keep offer identity only in slash-command/session memory once a campaign is launched
