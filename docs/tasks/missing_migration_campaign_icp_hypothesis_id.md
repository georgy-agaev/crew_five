# Bug: Unapplied migration for campaigns.icp_hypothesis_id

**Date:** 2026-03-21
**Status:** To Do
**Owner:** backend / Codex
**Severity:** Blocker — breaks `send-preflight`, `audit`, and any endpoint that calls `getCampaignDetail`

## Problem

`getCampaignDetail` in `src/services/campaigns.ts:301` selects `icp_hypothesis_id` from the `campaigns` table:

```typescript
.select('id,name,status,segment_id,segment_version,offer_id,icp_hypothesis_id,created_at,updated_at')
```

The column does not exist in the linked database yet, but the migration already exists in the
repository.

Error from Supabase:

```
code: '42703'
message: 'column campaigns.icp_hypothesis_id does not exist'
```

This breaks:

- `GET /api/campaigns/:id/send-preflight`
- `GET /api/campaigns/:id/audit`
- `GET /api/campaigns/:id/companies`
- any other endpoint that calls `getCampaignDetail` or `listCampaignCompanies`

## Required Fix

Apply the existing migration:

```bash
supabase db push
```

Relevant migration:

- `supabase/migrations/20260321234500_add_operational_hypothesis_fields.sql`

## Related Code

- `src/services/campaigns.ts:301` — `getCampaignDetail` select
- `src/services/campaigns.ts:41` — `createCampaign` sets `icp_hypothesis_id`
- `src/services/campaigns.ts:168` — `CampaignDetail` interface declares the field
- `src/web/routes/campaignRoutes.ts:467` — campaign create route passes `icpHypothesisId`
- `supabase/migrations/20260321234500_add_operational_hypothesis_fields.sql` — adds
  `campaigns.icp_hypothesis_id`
