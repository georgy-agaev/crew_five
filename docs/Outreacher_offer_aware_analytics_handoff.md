# Handoff: Offer-Aware Analytics for Outreach

**Date:** 2026-03-22
**Status:** Active

## New Analytics Dimensions

`crew_five` now supports:

- `analytics:summary --group-by offer`
- `analytics:summary --group-by hypothesis`
- `analytics:summary --group-by recipient_type`
- `analytics:summary --group-by sender_identity`

## Canonical Meaning

- `hypothesis` = targeting + messaging execution preset
- `offer` = business proposition
- `recipient_type` = resolved outbound recipient kind/source
- `sender_identity` = actual mailbox identity used for delivery

## Recommended Use

- use `hypothesis` when deciding which targeting/message preset to reuse next;
- use `offer` for business proposition comparison;
- use `recipient_type` to detect execution bias by recipient channel;
- use `sender_identity` to detect sender-level differences.

Keep `offer` and `offering` separate.
