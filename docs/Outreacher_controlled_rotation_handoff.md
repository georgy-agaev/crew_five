# Outreach Handoff: Controlled Rotation Preview

**Date:** 2026-03-22
**Status:** Done
**Owner:** backend / Codex

## What Is Ready

`crew_five` now exposes a canonical preview-only rotation surface:

- `pnpm cli campaign:rotation:preview --campaign-id <campaignId> --error-format json`

This is groundwork for operator / agent decisioning, not automatic send or automatic wave creation.

## Semantics

Rotation preview is anchored to:

- source campaign wave
- source ICP profile
- source / candidate hypotheses
- offer identity as execution context

Candidate pool:

- active hypotheses under the same ICP profile
- excludes the current source offer
- excludes hypotheses without an `offer_id`

## Canonical Global Stop Reasons

- `reply_received_stop`
- `suppressed_contact`
- `cooldown_active`
- `no_sendable_email`

## Canonical Candidate-Specific Stop Reason

- `already_received_candidate_offer`

## Recommended Runtime Usage

1. Load `campaign:rotation:preview`
2. Show source offer + source hypothesis clearly
3. Compare candidate hypothesis / offer pairs by eligible / blocked counts
4. Only after operator confirmation should a later flow create a new rotated wave

Do not infer a rotation decision from `offer_id` alone without keeping the hypothesis context visible.
