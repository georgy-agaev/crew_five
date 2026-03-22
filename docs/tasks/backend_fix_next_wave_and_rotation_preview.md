# Bug: next-wave-preview and rotation-preview backend failures

**Date:** 2026-03-22
**Status:** Done
**Owner:** backend / Codex
**Severity:** Blocker — both preview endpoints return 500

## Result

Both preview regressions are resolved.

## Bug 1: next-wave-preview — missing column

Observed error:
```text
code: '42703'
message: 'column campaigns.project_id does not exist'
```

This was not a missing backend code change. The required migration already existed:

- `supabase/migrations/20260322012000_add_projects_and_project_links.sql`

That migration adds:

- `public.projects`
- `campaigns.project_id`
- `offers.project_id`
- `icp_profiles.project_id`

Required operational fix:

```bash
supabase db push
```

No fallback code removal was applied because `project_id` is now part of the canonical
multi-project model.

## Bug 2: rotation-preview — HeadersOverflowError

Observed error:
```text
HeadersOverflowError: Headers Overflow Error (UND_ERR_HEADERS_OVERFLOW)
```

The failure path was broader than `campaignRotation.ts` alone:

- `campaignRotation.ts` depends on `campaign detail`
- `campaign detail` loaded audience rows with full snapshot payloads
- `campaignNextWave.ts` also loaded snapshot-heavy audience rows

Implemented backend fix:

- `campaignDetailReadModel.ts` now calls `listCampaignAudience(..., { includeSnapshot: false })`
- `campaignNextWave.ts` now calls `listCampaignAudience(..., { includeSnapshot: false })`

This keeps the canonical audience logic but removes oversized snapshot payloads from the hot path.

## Validation

Green after fix:

```bash
pnpm test tests/campaignDetailReadModel.test.ts tests/campaignNextWave.test.ts tests/campaignRotation.test.ts src/web/server.test.ts
pnpm build
pnpm lint
```

## Related

- audit had the same overflow bug, fixed by passing `includeSnapshot: false` to `listCampaignAudience`
- `campaigns.icp_hypothesis_id` had the same operational shape: migration already existed and needed
  to be applied via `supabase db push`
