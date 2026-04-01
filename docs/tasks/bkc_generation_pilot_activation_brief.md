# Task: BKC Generation Pilot Activation Brief

**Date:** 2026-03-25  
**Status:** Completed  
**Owner:** `crew_five`

## Purpose

Prepare one concrete pilot family so `Outreach` can validate richer generation
against canonical `crew_five` context without requiring the user to act as an
integration operator.

## Pilot Family

### Base wave

- Campaign: `dad76931-0ef5-4144-a84a-eaa4ae759334`
- Name: `ВКС-Less-30plus-2026-03`

### Existing family wave

- Campaign: `f51361b3-83d2-47b2-92dc-92b679cc792f`
- Name: `ВКС-Less-30plus-2026-03 — Wave 2`

### Attach validation wave

- Campaign: `92d9ff82-58b6-4d09-9113-b37e0ab06d77`
- Name: `ВКС-Less-30plus-2026-03 — Attach Validation`
- Status: `draft`

## Canonical Context Created

### Project

- Project id: `f88223b5-733e-4c3f-8e19-054538f28e3c`
- Key: `voicexpert-vks`
- Name: `VoiceXpert ВКС и переговорные`

### Offer

- Offer id: `13e71257-d4a5-4e2f-9c54-5f094f881714`
- Title: `Комплекты для видеоконференций в переговорные комнаты`

### Hypothesis

- Hypothesis id: `ea28784a-24c6-4d7e-a84c-e0ec8ee2c120`
- Label: `Оборудование переговорных комнат для небольших компаний`
- Status: `active`
- Messaging angle:
  `Стандартизация переговорных комнат под размер помещения и сценарий ВКС без универсальных шаблонов.`

## Canonical Links Applied

Applied to:

- ICP profile `fb805d33-d474-4e6a-b48d-bdf31431197e`
- Segment `735019e5-1ea8-41af-b3f8-a696b85e8d67`
- Base wave `dad76931-0ef5-4144-a84a-eaa4ae759334`
- Existing family wave `f51361b3-83d2-47b2-92dc-92b679cc792f`
- Attach validation wave `92d9ff82-58b6-4d09-9113-b37e0ab06d77`

Linked fields:

- `project_id`
- `offer_id`
- `icp_hypothesis_id`

## ICP Readiness

For this pilot ICP, structured fields were already populated and did not require
new backfill:

- `company_criteria`
- `persona_criteria`
- `learnings`

This means the pilot does **not** depend on parsing ICP meaning out of the
description blob alone.

## Attach Validation Setup

The attach validation campaign was created in `draft` status and manually
enriched with real attached contacts.

### Attached companies

- `09d5980b-721f-49d9-96c9-75122aaffab7` — `ООО "ТД Кардаильский Мукомольный Завод"`
- `b8e85556-50cc-49b0-8a37-ae7d3e827844` — `ООО "УК "Ритейл Менеджмент"`
- `6b5d156a-4ee3-47fb-a37b-af9da91f1d73` — `ООО "УК Акмаль-Холдинг"`

### Attach result

- requested companies: `3`
- attached companies: `3`
- inserted contacts: `8`

## Readiness Checks

Direct `crew_five` read-model verification confirmed:

### Base wave readiness

- `project` resolved
- `offer` resolved
- `icp_profile.company_criteria` present
- `icp_profile.persona_criteria` present
- `icp_profile.learnings` present
- `icp_hypothesis` resolved
- `recipient_email` resolved
- `audience_source = segment_snapshot` visible

### Attach validation readiness

- `project` resolved
- `offer` resolved
- `icp_hypothesis` resolved
- `manual_attach` provenance visible
- attached contacts visible: `8`

## Operational Note

If `Outreach` consumes `campaign:detail` through a long-running local web
adapter, restart that adapter before validation so the latest richer
`campaign:detail` read-model is served.

Direct `crew_five` service / CLI contract checks already see the updated
context.
