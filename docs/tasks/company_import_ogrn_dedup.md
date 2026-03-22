# Improve `company:import` OGRN Dedup Visibility

## Status

### Completed

- `company:import` already deduplicates by `tin`, then by `registration_number`
- dry-run and apply now expose `match_field`
- when a match happens by `registration_number` and the file TIN differs from the DB TIN,
  the item includes a `TIN mismatch` warning
- regression coverage exists for the case `same registration_number, different tin`

## Problem

The core OGRN dedup logic already existed, but operators could not see:

- which field produced the duplicate match
- why a row became `update` instead of `create`
- when the import file TIN differed from the DB TIN for the same OGRN

That made real dedup behavior hard to audit during batch imports.

## Expected Behavior

When a company matches by `registration_number`, preview/apply should expose:

```json
{
  "action": "update",
  "match_field": "registration_number",
  "warnings": ["TIN mismatch: file=2635800395, db=6325079752"]
}
```

## Context

This case is valid in real data: a company may be re-registered and get a different TIN while
keeping the same OGRN.

## Priority

High for operator confidence, but no longer a blocker for core import correctness.
