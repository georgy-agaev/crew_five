# Add Employee Name Repair Audit Trail

Source context:
- [employee_repair_names_review.md](/Users/georgyagaev/crew_five/docs/tasks/employee_repair_names_review.md)
- [2026-03-16_14_employee_name_repair_followups.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_14_employee_name_repair_followups.md)

## Goal

Add a durable audit trail for employee name repairs instead of relying only on command output and session docs.

## Current Status

### Completed

- `employee:repair-names` supports `--confidence high|low|all`
- `company:save-processed` normalizes obvious high-confidence swapped `first_name` / `last_name`
- low-confidence candidates remain unchanged and are surfaced via warnings
- durable audit records are written into `employee_data_repairs`
- audit records preserve original values, repaired values, confidence, and source
- identical reruns remain idempotent via a unique repair key

### To Do

- expose the audit trail to operators or downstream analytics if needed

## Why This Is Separate

`employees` does not have a `metadata` column, so repair history should not be hidden in unrelated fields such as
`ai_research_data`.

## Options

### Option 1 - Recommended

Add a dedicated table, for example `employee_data_repairs`, with:

- `id`
- `employee_id`
- `repair_type`
- `source`
- `confidence`
- `original_first_name`
- `original_last_name`
- `repaired_first_name`
- `repaired_last_name`
- `applied_at`

### Option 2

Add `employees.metadata jsonb` and store repair trail there.

- simpler schema surface
- weaker long-term structure and harder analytics

### Option 3

Keep audit trail only in CLI/session logs.

- cheapest
- not sufficient for durable operator or analytics needs

## Chosen Direction

Implemented Option 1 with `public.employee_data_repairs`.

## Acceptance Criteria

- applied repairs create durable audit records
- reruns remain idempotent and do not duplicate identical repair entries
- audit records preserve original and repaired values
- source distinguishes `employee:repair-names` from `company:save-processed`
