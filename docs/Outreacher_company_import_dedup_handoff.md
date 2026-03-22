# Outreacher Company Import Dedup Handoff

> Version: v0.2 (2026-03-18)

## Goal

Clarify how `Outreacher` should interpret duplicate matches during `company:import`,
especially when a company matches by OGRN (`registration_number`) but has a different TIN in the import file.

## Current Canonical Behavior In `crew_five`

`company:import` already deduplicates in this order:

1. `tin`
2. `registration_number`

This means:

- a company with the same OGRN but a different TIN is still treated as the same canonical company
- the import row should become `update`, not `create`

## What Changed

The import surface now exposes operator-visible dedup details:

- `match_field`
- `warnings`

Example:

```json
{
  "company_name": "ООО \"Ясон Агро\"",
  "tin": "2635800395",
  "action": "update",
  "match_field": "registration_number",
  "office_qualification": "Less",
  "warnings": ["TIN mismatch: file=2635800395, db=6325079752"]
}
```

## How `Outreacher` Should Use This

### Recommended interpretation

- `action = "update"` means the row maps to an existing canonical company
- `match_field = "tin"` means the company matched on TIN directly
- `match_field = "registration_number"` means the company matched by OGRN
- `TIN mismatch` warning means:
  - do not treat this as a failed dedup
  - do not create a second company
  - surface this to operators if they are reviewing import quality

### Recommended operator treatment

`Outreacher` should classify these rows as:

- importable
- not a hard error
- worthy of operator visibility if the user is reviewing import anomalies

## What `Outreacher` Should Not Assume

- do not assume OGRN match plus TIN mismatch means the import failed
- do not assume every warning means the row should be skipped
- do not reimplement duplicate resolution in `Outreacher`

`crew_five` remains the canonical dedup layer.

## Recommended UX In `Outreacher`

If import preview is shown to the user, a good operator-facing summary is:

- `created`
- `updated`
- `skipped`
- `matched by tin`
- `matched by registration_number`
- `TIN mismatch warnings`

This gives visibility without changing canonical persistence rules.

## Live Bugfix Note

On 2026-03-18 a real live regression was confirmed and fixed.

### What was happening

In the real Supabase client, the query builder used by `company:import` is mutable.
The fallback lookup in `findExistingCompany()` first tried:

1. `tin`
2. `registration_number`

But both lookups reused the same builder instance. That meant the second branch could inherit
the first `eq('tin', ...)`, effectively turning the OGRN fallback into:

- `tin AND registration_number`

instead of a clean fallback by `registration_number`.

### How it manifested

- dry-run incorrectly showed `action: "create"` and `match_field: null`
- apply could fail with:
  - `23505 duplicate key value violates unique constraint "companies_registration_number_key"`

### Current fixed behavior

`findExistingCompany()` now starts each lookup branch from a fresh `client.from('companies')`.

For the previously failing payload, `Outreacher` should now expect:

```json
{
  "action": "update",
  "match_field": "registration_number",
  "warnings": ["TIN mismatch: file=..., db=..."]
}
```

and apply should update the existing row instead of crashing on
`companies_registration_number_key`.
