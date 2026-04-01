# Handoff: Outreacher Next-Wave Support

**Date:** 2026-03-21
**Audience:** Outreach runtime / slash-command maintainers

## What is ready in `crew_five`

Canonical next-wave backend:

- `pnpm cli campaign:next-wave:preview --campaign-id <id> --error-format json`
- `pnpm cli campaign:next-wave:create --payload '<json>' --error-format json`

The backend reuses canonical source-wave context:

- `offer_id`
- `icp_hypothesis_id`
- send policy
- mailbox plan summary

Runtime clarification:

- `interactionMode` is not used in current `Outreach` runtime
- `dataQualityMode` is not used in current `Outreach` runtime

So these are no longer part of the operator-facing next-wave contract, even though backend legacy
defaults may still exist on the campaign row.

It also computes canonical blocked reasons:

- `suppressed_contact`
- `already_contacted_recently`
- `no_sendable_email`
- `already_in_target_wave`
- `already_used_in_source_wave`

## Practical meaning

- `crew_five` now owns reusable next-wave preview/create semantics
- `Outreach` should stop rebuilding this flow manually
- use preview first, then create a fresh wave only after operator confirmation

## Recommended runtime flow

1. Choose source campaign
2. Call `campaign:next-wave:preview`
3. Show:
   - reused defaults
   - candidate/eligible/blocked counts
   - blocked breakdown
4. Ask for new campaign name
5. Call `campaign:next-wave:create`
6. Continue with regular draft/review/send workflow on the new wave

## Important boundaries

- `Outreach` should not mutate the source wave
- `Outreach` should not write directly to `campaign_member_additions` or `campaign_member_exclusions`
- `Outreach` should not ask the operator to choose `interactionMode` or `dataQualityMode` for
  next-wave creation
- backend materializes:
  - eligible copied manual additions
  - blocked target-wave exclusions

## Key Semantics (Avoid Duplicate Companies)

`already_used_in_source_wave` is an *audience* dedupe guardrail:

- A `target_segment` candidate is blocked when its `company_id` (or `contact_id`) is already present
  in the source campaign audience (segment snapshot or manual attach).
- This does **not** depend on whether the source campaign has already sent emails.

This prevents “Wave 2 is a subset of Wave 1” when Wave 1 is still early (no outbounds yet), and
forces Wave 2 to contain only *new* segment members added since Wave 1.

## Example

```bash
pnpm cli campaign:next-wave:preview \
  --campaign-id camp-source \
  --error-format json
```

```bash
pnpm cli campaign:next-wave:create \
  --payload '{"sourceCampaignId":"camp-source","name":"Wave 2","createdBy":"outreacher"}' \
  --error-format json
```
