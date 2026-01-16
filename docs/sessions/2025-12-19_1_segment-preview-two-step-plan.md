# Session Plan – Segment Filter Preview (Two-Step Company Query)

> Date: 2025-12-19  
> Timestamp (UTC): 2025-12-19T10:35:09Z  
> Scope: Fix `companies.*` filters in Segment Builder preview using the minimal two-step query needed now.

## Short Overview

- Replace the current “single employees query with embedded company” preview logic with a minimal two-step approach when company-scoped filters are present.  
- Keep the existing filter DSL, allowlist, and Segment creation semantics intact; only change how preview counts are computed.  
- Verify that `companies.employee_count >= N` produces non-zero preview counts that match Supabase reality, without adding legacy fallbacks or generalised query builders we don’t need yet.

## Files to Touch (This Session Only)

- `src/services/filterPreview.ts` – implement two-step preview logic for company filters.  
- `tests/filterPreview.test.ts` – extend tests to cover two-step behaviour and realistic counts for `companies.employee_count`.  
- (Read-only) `src/filters/index.ts` – reuse existing `FilterClause` and field prefixes; no structural changes planned.  
- (Read-only) `src/web/server.ts` – ensure adapter continues to call `getFilterPreviewCounts` unchanged.

## Implementation Plan

### 1) Split Employee vs Company Filters Inside Preview Service

- Add a small helper in `src/services/filterPreview.ts`:
  - `splitFiltersByScope(filters: FilterClause[]): { employeeFilters: FilterClause[]; companyFilters: FilterClause[] }`  
    - Uses the existing field prefixes (`employees.` / `companies.`) to separate filters into two arrays.  
    - Does not modify or revalidate filters; assumes `parseSegmentFilters` has already enforced the allowlist.
- Update `getFilterPreviewCounts` to:
  - Call `parseSegmentFilters(filterDefinition)` once, then `splitFiltersByScope`.  
  - If there are no `companyFilters`, keep the current single-query path (employees with `company` embed) to avoid unnecessary refactors.  
  - If there are any `companyFilters`, branch into the two-step flow described below.

### 2) Two-Step Preview When Company Filters Are Present

- Company step (Supabase `companies` query):
  - Build a `companies` query that applies only company-scoped filters with direct column mappings:
    - `companies.segment` → `segment`  
    - `companies.employee_count` → `employee_count`
  - Use the same operator semantics as the DSL (`eq`, `in`, `not_in`, `gte`, `lte`).  
  - Execute:
    - A count-only query (`select('id', { count: 'exact', head: true })`) to get `matchedCompanyCount`.  
    - If `matchedCompanyCount > 0`, a second query (`select('id')`) to collect the matching company IDs into a `Set<string>`.
  - If `matchedCompanyCount === 0`, short-circuit and return `{ companyCount: 0, employeeCount: 0, totalCount: 0 }` without querying employees.

- Employee step (Supabase `employees` query):
  - Use the existing `buildContactQuery(client, employeeFilters)` to construct the base employees query, so employee-only logic stays DRY.  
  - If there are any company filters:
    - Apply an `in('company_id', [...companyIds])` constraint to the employee query before counting.  
  - Compute employee counts using the same pattern as today:
    - Count: `select(baseSelect, { count: 'exact', head: true })` with `company` embed preserved.  
    - Data: `select('company_id, company:companies(id, company_name, segment)')` to derive unique company IDs if needed.
  - Return:
    - `companyCount`: `companyIds.size` from the company step.  
    - `employeeCount`: count from the employee step.  
    - `totalCount`: alias of `employeeCount` (kept for contract compatibility).

### 3) Error Handling and Edge Cases

- Keep error surfaces consistent with the current implementation:
  - Wrap any Supabase errors from the company or employee steps as `Error('Failed to count employees: …')` / `Error('Failed to fetch employee data: …')` as appropriate.  
  - Do not change adapter or UI error formats; the Segment Builder still receives `API error 400: …` and formats via `formatPreviewError`.
- Edge cases to handle explicitly:
  - Empty `filterDefinition` → still rejected by `parseSegmentFilters` (existing behaviour).  
  - Company filters present but no matching companies → short-circuit to all-zero counts.  
  - Employee filters present without company filters → unchanged, single-step path.

## Function-Level Design

- `splitFiltersByScope(filters: FilterClause[]): { employeeFilters: FilterClause[]; companyFilters: FilterClause[] }`  
  Separates parsed filters into employee- and company-scoped arrays based purely on field prefixes. This keeps the rest of `getFilterPreviewCounts` simple and avoids re-encoding allowlist details.

- `applyCompanyFilters(query: any, companyFilters: FilterClause[]): any`  
  Applies company-scoped filters to a `companies` query using direct column names (`segment`, `employee_count`) and the standard operators, returning the mutated query for chaining.

- `getFilterPreviewCounts(client: SupabaseClient, filterDefinition: unknown): Promise<FilterPreviewResult>`  
  Validates the filter definition, runs the two-step company/employee counting logic when company filters are present, and produces consistent `{ companyCount, employeeCount, totalCount }` results used by both CLI and Web adapter.

## Tests to Add / Adjust

- `filterPreview splits filters by scope correctly`  
  Ensures `splitFiltersByScope` returns the right filters in `employeeFilters` vs `companyFilters`.

- `filterPreview two-step flow applies company filters first`  
  Asserts that when company filters are present, a `from('companies')` query is built and invoked before the employees query.

- `filterPreview counts non-zero employees for employee_count >= 45`  
  Mocks Supabase responses so `companies.employee_count >= 45` yields realistic, non-zero `companyCount` and `employeeCount`.

- `filterPreview short-circuits to zero when no companies match`  
  Verifies that if the company step count is zero, the employee step is skipped and all counts are zero.

- `filterPreview preserves legacy path when no company filters`  
  Confirms that purely employee-based filters still use the existing single-query path and that behaviour is unchanged.

## Notes / Non-Goals

- We will **not** change the filter DSL shape, allowlist, or Segment persistence logic in this session.  
- No new fallback modes or legacy compatibility layers will be added; only the minimal two-step preview logic required for company filters will be implemented.  
- Web UI components (`FilterRow`, `SegmentBuilder`) and `/api/filters/preview` adapter contract will remain unchanged, aside from seeing more accurate counts when company filters are used.

## Status – 2025-12-19T20:14:10Z

- Implemented `splitFiltersByScope` and `applyCompanyFilters` in `src/services/filterPreview.ts`, and updated `getFilterPreviewCounts` to run a two-step preview when `companies.*` filters are present: first resolve matching company ids via a `companies` query, then constrain the `employees` query with `in('company_id', [...companyIds])` while still applying any employee-scoped filters.  
- Updated `tests/filterPreview.test.ts` to exercise the new path for `companies.employee_count` using separate mocks for `companies` and `employees` tables, including an assertion that the employees query is constrained by `company_id` and that preview returns `{ companyCount: 2, employeeCount: 5, totalCount: 5 }` for the happy path.  
- Ran `pnpm test tests/filterPreview.test.ts`, `pnpm lint`, and `pnpm build`; all pass (lint reports warnings only). End-to-end manual preview calls against the live adapter will be validated in the next step.
