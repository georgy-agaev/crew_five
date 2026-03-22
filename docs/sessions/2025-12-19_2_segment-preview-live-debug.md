# Session Plan – Segment Filter Preview Live Debug

> Date: 2025-12-19  
> Timestamp (UTC): 2025-12-19T21:24:30Z  
> Scope: Fix live `/api/filters/preview` behaviour so `companies.employee_count` filters return realistic company/employee counts (matching Supabase data) in the web UI.

## Short Overview

- Diagnose why the new two-step preview logic returns `0` companies/employees in the live adapter for `companies.employee_count >= N`, despite Supabase SQL showing many matches.  
- Tighten backend query construction and tests so company-scoped numeric filters behave identically in tests and in the real Supabase environment.  
- Verify the full flow from Segment Builder → `/api/filters/preview` → Supabase and update docs once the Preview panel shows correct counts.

## Files To Change (This Session Only)

- `src/services/filterPreview.ts` – refine company-step query construction and guardrails; add minimal logging hooks if needed.  
- `tests/filterPreview.test.ts` – strengthen tests to cover count vs data queries and ensure company filter application order.  
- `web/src/hooks/useFilterPreview.ts` – (read-only, confirm contract only; no changes expected).  
- `web/src/components/SegmentBuilder.tsx` / `web/src/components/FilterRow.tsx` – (read-only, confirm operators & field names only; no changes expected).  
- `docs/sessions/2025-12-19_2_segment-preview-live-debug.md` – this plan + status updates.  
- `CHANGELOG.md` – append a brief note once live filter preview is fixed.

## Implementation Plan – Focused Functionality Only

### 1) Confirm Current Behaviour & Inputs

- Reproduce the problem with a direct POST to `/api/filters/preview` using `companies.employee_count` and capture the request/response shape.  
- Double-check that UI `FilterDefinition` objects match backend expectations (`field`, `operator` in `['eq','in','not_in','gte','lte']`, numeric `value` for `gte`/`lte`).  
- No legacy or fallback paths; focus only on `companies.employee_count` and similar company-level fields.

### 2) Harden Company-Step Query Construction

- Ensure `applyCompanyFilters` always operates on a filter-capable Supabase builder and that filters are applied **before** any count/data `select` calls.  
- Explicitly map company filters to `from('companies').select('id')` style queries in both the count and data paths, avoiding ambiguous builder state.  
- Keep employee-step logic unchanged, aside from relying on a clean `companyIds` array from the company step.

### 3) Align Tests With Live Behaviour

- Add tests that simulate separate `companies` and `employees` builders, including the sequence: `from('companies')` → filters → `select('id', { count: 'exact', head: true })` → `select('id')`.  
- Add a test where company filters exist but employees are filtered down to zero, confirming we return `{0,0,0}` without errors.  
- Ensure there is a test that explicitly covers `companies.employee_count >= 45` returning non-zero counts from both steps.

### 4) Verify Adapter Wiring & Web UI End-to-End

- Run `WEB_ADAPTER_MODE=live pnpm tsx src/web/server.ts` and confirm `/api/meta` reports `mode: live` and Supabase is ready.  
- From the browser devtools console, call `/api/filters/preview` directly with `companies.employee_count >= 45` and confirm non-zero counts.  
- Use Segment Builder UI to set the same filter and verify the Preview panel matches the API response and no validation errors appear.

### 5) Documentation & Session Status

- Update this session doc with outcomes, noting which tests cover which behaviours and mark tasks as **Completed** vs **To Do**.  
- Append a brief entry to `CHANGELOG.md` describing “Fix segment filter preview for company-level numeric filters”.  
- If any remaining edge cases are identified (e.g., additional company metrics), capture them as **To Do** follow-ups for future sessions.

## Function-Level Plan

- `splitFiltersByScope(filters: FilterClause[])`  
  Continue using this helper to separate `employees.*` and `companies.*` filters; verify it remains a pure splitter with no side effects.

- `applyCompanyFilters(query: any, companyFilters: FilterClause[])`  
  Apply `companies.segment` / `companies.employee_count` filters to a `companies` query, ensuring all operators (`eq`, `in`, `not_in`, `gte`, `lte`) are mapped correctly and applied before count/data selects.

- `getFilterPreviewCounts(client: SupabaseClient, filterDefinition: unknown)`  
  Orchestrate validation, company-step counting, employee-step counting, and result aggregation; ensure the company-step query returns realistic counts that drive the employee-step correctly.

## Tests To (Re)Focus

- `filterPreview should apply company filters before counting companies`  
  Verify `from('companies')` receives filters prior to `select('id', { count: 'exact' })`.

- `filterPreview should return non-zero counts for companies.employee_count gte 45`  
  Mock Supabase so company and employee queries both see matches; expect positive company/employee counts.

- `filterPreview should short-circuit when no companies match company filters`  
  Simulate company count `0`; ensure employee query is never called and result is all zeros.

- `filterPreview should keep employee-only filters on single-step path`  
  Confirm behaviour for `employees.*` filters is unchanged and still uses the legacy single employees query.

## Task Tracker

- **Completed**  
  - Drafted focused session plan for debugging live filter preview behaviour and saved it in `docs/sessions/`.  
  - Refined `applyCompanyFilters` in `src/services/filterPreview.ts` to upgrade base `from('companies')` builders that lack comparison/list operators via `.select('*')` before applying company-scoped filters.  
  - Extended `tests/filterPreview.test.ts` with a mixed-builder test case (“base builder without gte, filter builder returned by .select('*')”) plus happy-path coverage, and ran `pnpm test tests/filterPreview.test.ts` and `pnpm build` successfully.  
  - Added `0.1.78` entry to `CHANGELOG.md` documenting the hardened company-step preview logic and new tests.
  - Implemented a DSL-wide `contains` operator (mapped to `ILIKE '%value%'`) for string fields, wired it through backend filters, preview service, web types/UI, and filter coach documentation so employee position filters like `employees.position contains "Генеральный"` work consistently across preview, snapshot, and AI-suggested filters.

- **To Do**  
  - Run the live web adapter (`WEB_ADAPTER_MODE=live pnpm tsx src/web/server.ts`) and verify `/api/filters/preview` returns non-zero counts for `companies.employee_count >= 45` in the user’s Supabase environment.  
  - Confirm Segment Builder’s Preview panel shows matching company/employee counts for the same filter and record any remaining edge cases for future sessions.

## Details / Remarks

- Creating a segment from the Segment Builder **does not** populate `segment_members` immediately. The `Create Segment` action only inserts a row into `segments` with the JSON `filter_definition`; the live Preview numbers come from `/api/filters/preview` and are not persisted. Segment membership is materialized later by running a snapshot (`snapshotSegment` / `ensureSegmentSnapshot`), which reuses the same DSL (including `contains`) via `buildContactQuery`, selects matching contacts, and inserts them into `segment_members`. Until a snapshot is created for a given segment/version, UI summaries and database views that rely on `segment_members` will show `0 companies`, even if the Preview panel showed a non-zero match count at creation time.
- ICP profile creation failures on the ICP tab (`POST /api/icp/profiles` returning 500) were traced to a schema mismatch: the live `icp_profiles` table does not yet have the `phase_outputs` column that the service layer was inserting into. The `createIcpProfile` helper now retries once without `phase_outputs` when it detects this specific error, so web and CLI flows can create profiles against the current schema while still remaining forward-compatible with the migration that adds `phase_outputs` later on.\n
