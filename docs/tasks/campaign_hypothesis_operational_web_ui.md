# Task: Campaign Hypothesis Operational Web UI

**Status:** Done

## Goal

Expose operational hypothesis selection and visibility in the launch / campaign UI on top of the
new backend contract.

## Backend Already Ready

- `GET /api/icp/hypotheses`
- `POST /api/icp/hypotheses`
- `POST /api/campaigns`
- `POST /api/campaigns/launch-preview`
- `POST /api/campaigns/launch`
- `GET /api/campaigns/:campaignId/detail`

Operational hypothesis fields now available:

- `offer_id`
- `targeting_defaults`
- `messaging_angle`
- `pattern_defaults`
- `notes`

Campaigns now persist:

- `campaigns.icp_hypothesis_id`

## Required UI Work

- Add hypothesis picker to campaign launch flows:
  - `CampaignLaunchDrawer`
  - any raw campaign-create fallback still exposed in Web UI
- When an offer is selected, prefer hypotheses linked to that offer first.
- If no hypothesis is selected, launch should still work.
- If a hypothesis is selected:
  - pass `icpHypothesisId` into preview and launch
  - show linked `messaging_angle` / preset summary in preview
- Show linked hypothesis in normal campaign context:
  - `Campaigns`
  - `Builder V2`

## UX Rules

- `offer` and `hypothesis` are separate objects; do not collapse them into one label.
- If a hypothesis is linked to an offer, render both:
  - offer = business proposition
  - hypothesis = targeting + messaging preset
- Keep it compact; no large management screen in this task.

## Out Of Scope

- Full hypothesis CRUD surface
- Hypothesis analytics dashboard
- Next-wave creation UI
