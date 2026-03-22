# Outreacher Campaign Wave Attach Handoff

> Version: v0.1 (2026-03-21)

## Goal

Expose one canonical way for `Outreacher` to add already-processed companies into an existing
campaign wave without mutating the source segment definition.

## What Is Now Available

CLI:

```bash
pnpm cli campaign:attach-companies \
  --campaign-id <campaignId> \
  --company-ids '["co-1","co-2"]' \
  --attached-by outreacher \
  --source import_workspace \
  --error-format json
```

## Canonical Semantics

- attach is additive and campaign-scoped
- base `segment_members` stay unchanged
- attached contacts are persisted in `campaign_member_additions`
- the effective campaign audience becomes:
  - base segment snapshot rows
  - plus manual attach rows

This unified audience is now read by:

- draft generation
- campaign company / detail read models
- campaign audit
- Smartlead send preparation

## Recommended Usage

Use attach only after:

1. company import
2. processing / employee extraction
3. operator or agent chooses a specific existing campaign wave

Do not:

- mutate `segments.filter_definition`
- rewrite `segment_members`
- treat attach as a send-time mutation

## Response Shape

Representative response:

```json
{
  "campaignId": "camp-1",
  "summary": {
    "requestedCompanyCount": 2,
    "attachedCompanyCount": 1,
    "alreadyPresentCompanyCount": 1,
    "blockedCompanyCount": 0,
    "invalidCompanyCount": 0,
    "insertedContactCount": 3,
    "alreadyPresentContactCount": 2
  },
  "items": [
    {
      "companyId": "co-1",
      "companyName": "Acme",
      "status": "attached",
      "insertedContactCount": 3,
      "alreadyPresentContactCount": 0,
      "reason": null
    }
  ]
}
```
