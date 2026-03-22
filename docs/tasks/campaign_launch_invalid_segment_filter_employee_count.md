# Bug: campaign launch fails for segments that still reference invalid `employee_count` filter field

## Status

Completed.

## Problem

`campaign:launch` can fail at runtime for existing segments whose stored filter definition still
contains legacy `employee_count` instead of the canonical directory field path.

Observed live error from `POST /api/campaigns/launch`:

```json
{
  "error": "Unknown field: employee_count. Allowed fields: employees.id, employees.role, employees.position, employees.processing_status, employees.work_email_status, employees.generic_email_status, companies.segment, companies.employee_count, companies.office_qualification"
}
```

This was reproduced from the Web launch drawer while launching against segment
`735019e5-1ea8-41af-b3f8-a696b85e8d67` (`ВКС-Less-30plus-2026-03`).

## Why it matters

- launch preview can succeed on a segment
- launch mutation then fails with a generic server error in UI
- operator cannot distinguish send-policy issues from bad segment filter state

## Implemented fix

Canonical backend normalization was added in the shared filter compatibility layer:

- legacy `employee_count` now maps to canonical `companies.employee_count`
- `parseSegmentFilters()` accepts existing stored segments with that legacy field
- `ensureSegmentSnapshot()` can refresh or reuse snapshots for those segments without launch-time
  failure

This keeps existing stored segments launchable without forcing an emergency data migration.

## Reproduction

1. Open `Campaigns -> Launch`
2. Use segment `ВКС-Less-30plus-2026-03`
3. Set explicit send policy and confirm it
4. Preview succeeds
5. Press `Launch`
6. Backend returns `500` with invalid filter field error for `employee_count`

## Notes

- This bug is separate from send policy
- send policy persistence was verified successfully on another valid segment in the same live smoke
- Regression coverage was added for both:
  - filter parsing compatibility
  - snapshot workflow execution with legacy `employee_count`
