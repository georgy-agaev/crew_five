# Handoff: Wave/Next-Wave Dedupe Guardrail (No Duplicate Companies)

**Date:** 2026-03-30  
**Audience:** Outreach runtime maintainers, operator-desk users  
**Scope:** `Wave` (next-wave) creation semantics in `crew_five`

## Problem

Operators observed that `Wave 2` could be populated with the same companies as `Wave 1`, even when
Wave 1 was already active (status `sending`). This caused duplicate generation and duplicate
outreach, wasting tokens/credits and damaging trust.

Root cause was that `already_used_in_source_wave` was effectively inferred from **sent outbounds**,
so if Wave 1 had not sent yet, all contacts looked eligible for Wave 2.

## What Changed

`crew_five` next-wave evaluation now treats `already_used_in_source_wave` as a **source-audience**
dedupe guardrail:

- A `target_segment` candidate is blocked when its `company_id` (or `contact_id`) already exists in
  the source campaign audience (segment snapshot or manual attach).
- This is independent of whether Wave 1 has sent any emails yet.
- Manual attaches from the source wave are still eligible to be copied to the new wave when they
  are not part of the target segment and are otherwise eligible.

## Expected Operator Behavior

- If the target segment snapshot did not change since Wave 1, Wave 2 preview should show:
  - `eligibleContactCount = 0`
  - blocked breakdown dominated by `already_used_in_source_wave`
- To create a meaningful Wave 2:
  - refresh/bump the segment snapshot so it contains new companies not present in Wave 1, or
  - select a different target segment for Wave 2

## Validation Protocol (CLI)

1. Preview:

```bash
pnpm cli campaign:next-wave:preview \
  --campaign-id <wave1_campaign_id> \
  --error-format json
```

2. Create:

```bash
pnpm cli campaign:next-wave:create \
  --payload '{"sourceCampaignId":"<wave1_campaign_id>","name":"<Wave 2 name>","createdBy":"outreach"}' \
  --error-format json
```

3. Success criteria:

- Preview items for any contact/company present in Wave 1 must be marked:
  - `eligible=false`
  - `blockedReason="already_used_in_source_wave"`
- Newly-added segment members (not in Wave 1 audience) can be eligible, subject to:
  - suppression
  - recent contact window
  - sendable email

## Notes

This fix targets the **audience composition** problem. It does not impose a global "one intro per
company forever" rule at send-time, because `crew_five` must support sending intro to multiple
employees of the same company within a single campaign.

