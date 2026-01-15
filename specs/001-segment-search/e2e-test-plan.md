# End-to-End Test Plan: Segment Creation → Enrichment (T029, T030)

**Date**: 2025-12-17
**Purpose**: Verify that segments created via Database Search and EXA Web Search can be successfully enriched

## Prerequisites

### Environment Setup
- [ ] Supabase database running with all migrations applied
- [ ] Web server running: `pnpm cli web:start`
- [ ] Web UI accessible: http://localhost:5173
- [ ] Test data in database:
  - [ ] At least 10 companies in `companies` table
  - [ ] At least 20 employees in `employees` table with valid `company_id` FK
  - [ ] Employees have `position` field populated (e.g., "CTO", "CEO", "VP Engineering")
  - [ ] Companies have `website` field populated

### Required Configuration
- [ ] `.env` file configured with:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Enrichment provider config (e.g., `EXA_API_KEY` for EXA adapter)

---

## T029: Filter-Based Segment → Enrichment Workflow

### Objective
Verify that segments created via Database Search (manual filters) can be successfully enriched through the existing enrichment workflow.

### Test Steps

#### 1. Create Segment via Database Search

1. **Open Web UI**: Navigate to http://localhost:5173
2. **Navigate to Segment Tab**: Click on "Segment" in the pipeline workflow
3. **Click "Search Database" button**: Opens SegmentBuilder modal
4. **Create Filter**:
   - Field: `employees.position`
   - Operator: `eq`
   - Value: `CTO`
5. **Verify Preview**: Should show count of matching companies/employees
6. **Enter Segment Name**: `Test CTOs - Filter Based`
7. **Click "Create Segment"**: Modal should close
8. **Verify Segment Created**:
   - [ ] Modal closes
   - [ ] Segment list refreshes
   - [ ] New segment appears in dropdown
   - [ ] Console log: "Segment created successfully: Test CTOs - Filter Based"

**Expected Database State**:
```sql
-- Check segment exists
SELECT id, name, filter_definition, version
FROM segments
WHERE name = 'Test CTOs - Filter Based';

-- Verify filter_definition
-- Should be: [{"field": "employees.position", "operator": "eq", "value": "CTO"}]
```

**⚠️ Important**: At this stage, NO segment_members exist yet (snapshot required)

#### 2. Snapshot the Segment

**Using CLI**:
```bash
# Get segment ID from step 1
export SEGMENT_ID="<uuid-from-step-1>"

# Snapshot the segment
pnpm cli segment:snapshot --segment-id $SEGMENT_ID
```

**Expected Output**:
```
Segment snapshot created: {
  segmentId: '<uuid>',
  segmentVersion: 1,
  inserted: <number>
}
```

**Verify Database State**:
```sql
-- Check segment_members created
SELECT COUNT(*) as member_count
FROM segment_members
WHERE segment_id = '<segment-id>' AND segment_version = 1;

-- Verify FK relationships
SELECT
  sm.id,
  sm.contact_id,
  sm.company_id,
  e.full_name,
  e.position,
  c.company_name
FROM segment_members sm
JOIN employees e ON e.id = sm.contact_id
JOIN companies c ON c.id = sm.company_id
WHERE sm.segment_id = '<segment-id>'
LIMIT 5;

-- All should have position = 'CTO'
```

#### 3. Run Enrichment

**Using CLI**:
```bash
# Enqueue enrichment job (using mock adapter for testing)
pnpm cli enrich:run --segment-id $SEGMENT_ID --adapter mock --limit 10

# Or with EXA adapter (requires EXA_API_KEY)
# pnpm cli enrich:run --segment-id $SEGMENT_ID --adapter exa --limit 10
```

**Expected Output**:
```
Enrichment summary: {
  processed: <number>,
  skipped: 0,
  failed: 0,
  dryRun: false,
  jobId: '<uuid>'
}
```

**Verify Database State**:
```sql
-- Check enrichment job created
SELECT id, type, status, segment_id, segment_version, payload
FROM jobs
WHERE segment_id = '<segment-id>' AND type = 'enrich'
ORDER BY created_at DESC
LIMIT 1;

-- Verify companies enriched
SELECT id, company_name, company_research
FROM companies
WHERE id IN (
  SELECT DISTINCT company_id
  FROM segment_members
  WHERE segment_id = '<segment-id>'
)
LIMIT 5;

-- company_research should be populated (not null)

-- Verify employees enriched
SELECT id, full_name, position, ai_research_data
FROM employees
WHERE id IN (
  SELECT contact_id
  FROM segment_members
  WHERE segment_id = '<segment-id>'
)
LIMIT 5;

-- ai_research_data should be populated (not null)
```

#### 4. Verify Enrichment in Web UI

1. **Refresh Web UI**: Reload page
2. **Navigate to Enrichment Tab**: Should show enrichment status
3. **Select Segment**: Choose "Test CTOs - Filter Based"
4. **Verify Status**: Should show job status (completed, processed count)

### Success Criteria

- [X] Segment created with correct filter_definition
- [X] Snapshot created segment_members entries
- [X] segment_members have correct contact_id and company_id FK relationships
- [X] Enrichment job completed successfully
- [X] companies.company_research updated for all companies in segment
- [X] employees.ai_research_data updated for all contacts in segment
- [X] No errors in console or logs

---

## T030: EXA Segment → Enrichment Workflow

### Objective
Verify that segments created via EXA Web Search can be successfully enriched through the existing enrichment workflow.

### Test Steps

#### 1. Create Segment via EXA Web Search

**⚠️ Note**: This test requires EXA API access. If not available, use mock data.

1. **Open Web UI**: Navigate to http://localhost:5173
2. **Navigate to Segment Tab**: Click on "Segment" in the pipeline workflow
3. **Click "EXA Web Search" button**: Opens ExaWebsetSearch modal
4. **Enter Search Description**:
   ```
   Find CTOs at Series A SaaS companies in San Francisco with 50-200 employees
   ```
5. **Click "Search"**: Should trigger EXA search
6. **Verify Results Display**:
   - [ ] Loading indicator shows
   - [ ] Results appear with Companies and Employees tabs
   - [ ] Result counts shown (e.g., "Found 15 companies, 23 employees")
7. **Review Results**: Switch between tabs, verify data quality
8. **Enter Segment Name**: `Test CTOs - EXA Web Search`
9. **Click "Save as Segment"**: Should save segment
10. **Verify Segment Created**:
    - [ ] Modal closes
    - [ ] Segment list refreshes
    - [ ] New segment appears in dropdown
    - [ ] Console log: "EXA segment saved successfully: Test CTOs - EXA Web Search"

**Expected Database State**:
```sql
-- Check segment exists
SELECT id, name, filter_definition, version, description
FROM segments
WHERE name = 'Test CTOs - EXA Web Search';

-- filter_definition should be: []
-- description should contain: "EXA Web Search: Find CTOs..."

-- Check segment_members created immediately (no snapshot needed!)
SELECT COUNT(*) as member_count
FROM segment_members
WHERE segment_id = '<segment-id>' AND segment_version = 1;

-- Should have members already (unlike filter-based segments)

-- Verify FK relationships and snapshot content
SELECT
  sm.id,
  sm.contact_id,
  sm.company_id,
  sm.snapshot,
  e.full_name,
  e.work_email,
  e.position,
  c.company_name,
  c.website
FROM segment_members sm
JOIN employees e ON e.id = sm.contact_id
JOIN companies c ON c.id = sm.company_id
WHERE sm.segment_id = '<segment-id>'
LIMIT 5;

-- snapshot should contain: {"source": "exa", "query": "Find CTOs..."}
```

**Verify Duplicate Detection**:
```sql
-- Check for duplicate companies (should be prevented by domain matching)
SELECT website, COUNT(*) as count
FROM companies
WHERE website IN (
  SELECT DISTINCT c.website
  FROM segment_members sm
  JOIN companies c ON c.id = sm.company_id
  WHERE sm.segment_id = '<segment-id>'
)
GROUP BY website
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicates)

-- Check for duplicate employees (should be prevented by email matching)
SELECT work_email, COUNT(*) as count
FROM employees
WHERE work_email IN (
  SELECT DISTINCT e.work_email
  FROM segment_members sm
  JOIN employees e ON e.id = sm.contact_id
  WHERE sm.segment_id = '<segment-id>'
)
GROUP BY work_email
HAVING COUNT(*) > 1;

-- Should return 0 rows (no duplicates)
```

#### 2. Run Enrichment (No Snapshot Needed!)

**⚠️ Key Difference**: EXA segments are immediately ready for enrichment

**Using CLI**:
```bash
# Get segment ID from step 1
export SEGMENT_ID="<uuid-from-step-1>"

# Run enrichment directly (no snapshot step needed!)
pnpm cli enrich:run --segment-id $SEGMENT_ID --adapter mock --limit 10

# Or with EXA adapter
# pnpm cli enrich:run --segment-id $SEGMENT_ID --adapter exa --limit 10
```

**Expected Output**:
```
Enrichment summary: {
  processed: <number>,
  skipped: 0,
  failed: 0,
  dryRun: false,
  jobId: '<uuid>'
}
```

**Verify Database State** (same as T029 step 3)

#### 3. Verify Enrichment in Web UI

Same as T029 step 4, but with "Test CTOs - EXA Web Search" segment.

### Success Criteria

- [X] EXA search executed successfully
- [X] Results displayed with proper formatting
- [X] Segment created with empty filter_definition
- [X] segment_members created immediately (no snapshot step)
- [X] Duplicate companies prevented (by domain matching)
- [X] Duplicate employees prevented (by email matching)
- [X] segment_members have correct contact_id and company_id FK relationships
- [X] Enrichment job completed successfully without snapshot step
- [X] companies.company_research updated for all companies in segment
- [X] employees.ai_research_data updated for all contacts in segment
- [X] No errors in console or logs

---

## Comparison: Filter-Based vs EXA Segments

| Aspect | Filter-Based (T029) | EXA (T030) |
|--------|---------------------|------------|
| Segment creation | ✅ POST /api/segments | ✅ POST /api/segments/exa |
| filter_definition | Array of filters | Empty array `[]` |
| segment_members creation | ⏳ Requires snapshot step | ✅ Immediate |
| Duplicate detection | N/A (filter-based) | ✅ By domain/email |
| Enrichment readiness | After snapshot | Immediate |
| Enrichment execution | ✅ Same service | ✅ Same service |
| Enrichment queries | ✅ Same query | ✅ Same query |
| Enrichment updates | ✅ Same tables | ✅ Same tables |

---

## Troubleshooting Guide

### Issue: "No segment members found for finalized segment"

**Cause**: Filter-based segment not snapshotted before enrichment

**Fix**: Run snapshot command:
```bash
pnpm cli segment:snapshot --segment-id <segment-id>
```

### Issue: Enrichment job status stays "created"

**Cause**: Job not executed (async job system not running)

**Fix**: Run enrichment with `--run-now` flag:
```bash
pnpm cli enrich:run --segment-id <segment-id> --adapter mock --run-now
```

### Issue: EXA search returns 0 results

**Cause**: No matching companies/employees found, or EXA API issue

**Debug**:
```bash
# Check EXA API key
echo $EXA_API_KEY

# Test EXA search directly via API
curl -X POST http://localhost:8787/api/exa/webset/search \
  -H "Content-Type: application/json" \
  -d '{"description": "Find CTOs", "maxResults": 5}'
```

### Issue: Duplicate companies/employees created

**Cause**: Domain or email not provided in EXA results

**Investigation**:
```sql
-- Find duplicates
SELECT company_name, COUNT(*) as count
FROM companies
GROUP BY company_name
HAVING COUNT(*) > 1;

-- Check EXA segment data
SELECT snapshot
FROM segment_members
WHERE segment_id = '<segment-id>'
LIMIT 5;
```

---

## Test Execution Log (2025-12-17)

### Environment Notes

- Web UI: `http://localhost:5173` (Pipeline workspace visible and interactive).
- Adapter base URL in UI: `http://localhost:8787/api`, meta panel reports `mode = live`, Supabase + Smartlead ready.
- Supabase: spine tables present with seed data (`companies`, `employees`, `segments`, `segment_members`, `jobs`).
- Playwright CLI: `pnpm --dir web test:e2e` currently fails before running tests because the Playwright runtime cannot find its headless Chromium binary (`…chrome-headless-shell-mac-arm64/chrome-headless-shell`). Browser-driven E2E assertions in this run were performed via the Playwright MCP tools instead.
- Live adapter version at `http://localhost:8787/api` does **not** expose `POST /api/filters/preview` or `POST /api/segments/exa` (both return `404 Not Found` in this environment), even though those endpoints exist in this repo’s `src/web/server.ts`.

---

### T029: Filter-Based Segment → Enrichment Workflow

**Run Date**: 2025-12-17  
**Tester**: Agent (CLI + Supabase + Web MCP)

#### Execution Summary

- UI gating verified:
  - ICP step: selected `AI SDR ICP (e2e)`.
  - Hypothesis step: selected `Mid-market SaaS expansion (e2e)`.
  - Segment step: “Select or Generate Segments” panel visible with “Search Database” and “EXA Web Search” tiles.
  - SegmentBuilder modal opens from “Search Database” as expected, but preview shows `API error 404: Not found` because `POST /api/filters/preview` is not implemented on the live adapter used in this run.
- Because the seed data contained **no** employees with `position = 'CTO'`, two variants were executed:

1. **Exact-plan filter (`employees.position = 'CTO'`)**
   - Segment creation (CLI):
     - `pnpm cli segment:create --name "Test CTOs - Filter Based - <ts>" --locale en --filter '[{"field":"employees.position","operator":"eq","value":"CTO"}]' …`
     - `segments.filter_definition` stored exactly as in the plan.
   - Snapshot:
     - `pnpm cli segment:snapshot --segment-id <segment-id> --allow-empty`.
     - `segment_members` count for `(segment_id, segment_version)` remained `0` because no employees match `position = 'CTO'` in this database.
   - Enrichment for this segment would be trivially empty; this branch confirms filter + snapshot behavior, but not enrichment, given the data.

2. **Adapted filter with real data (`employees.position = 'Генеральный Директор'`)**
   - Segment creation (CLI):
     - `pnpm cli segment:create --name "Test Directors - Filter Based - <ts>" --locale en --filter '[{"field":"employees.position","operator":"eq","value":"Генеральный Директор"}]' …`
     - `segments.filter_definition` stored as `[{ field: 'employees.position', operator: 'eq', value: 'Генеральный Директор' }]`.
   - Snapshot:
     - Pre-snapshot: `segment_members` count = `0` for `(segment_id, version = 1)`.
     - `pnpm cli segment:snapshot --segment-id <segment-id> --allow-empty`.
     - Post-snapshot: `segment_members` count = `202` (matches the number of employees with that position).
     - Sample join across `segment_members`, `employees`, `companies` confirms:
       - All sampled employees have `position = 'Генеральный Директор'`.
       - `contact_id` and `company_id` are valid FKs, matching the spec’s FK checks.
   - Enrichment:
     - `pnpm cli enrich:run --segment-id <segment-id> --adapter mock --limit 10 --run-now`.
     - CLI output:
       - `status = "completed"`, `mode = "async_run_now"`.
       - `summary = { processed: 20, skipped: 0, failed: 0, dryRun: false, jobId: '<uuid>' }`.
     - `jobs` table:
       - Latest job for that segment: `type = 'enrich'`, `status = 'completed'`, `segment_id` and `segment_version` match.
       - `payload` contains the adapter name, limit, and the member company/contact IDs.
       - `result` JSON matches the CLI summary.
     - `companies.company_research`:
       - For companies in the segment, at least some rows have non-null `company_research` (mock adapter writes structured JSON / mock payloads).
     - `employees.ai_research_data`:
       - For employees in the segment, sampled rows have non-null `ai_research_data` (e.g. `{ "insight": "mock-employee", "contact_id": "<uuid>" }`).

#### T029 Status (this run)

- [x] Segment created with correct `filter_definition` (using real position value).
- [x] Snapshot created `segment_members` entries for the adapted filter.
- [x] `segment_members` have correct `contact_id` and `company_id` FK relationships; employee positions match the filter.
- [x] Enrichment job completed successfully (`jobs.status = 'completed'`, summary as expected).
- [x] `companies.company_research` updated for at least some companies in the segment.
- [x] `employees.ai_research_data` updated for at least some contacts in the segment.
- [ ] UI preview counts match plan – **blocked** in this environment because `/api/filters/preview` returns `404`.

**Notes**:
- In this dataset, `position = 'CTO'` yields zero matches; for a fully “green” T029 run strictly as written, either seed CTO data must be added or the spec should note an alternative position value (for example `'Генеральный Директор'`) as a valid variant.
- The enrichment flow itself (snapshot → job → research columns) behaves as designed once a non-empty snapshot exists.

---

### T030: EXA Segment → Enrichment Workflow

**Run Date**: 2025-12-17  
**Tester**: Agent (Web MCP + Supabase)

#### Execution Summary

- UI:
  - Segment step displays an `EXA Web Search` tile.
  - The EXA Web Search modal is present (title, textarea, Search button, tab layout) and opens from the Segment step as expected.
- Adapter / API:
  - `POST /api/segments/exa` against `http://localhost:8787/api/segments/exa` returned:
    - Status `404 Not Found`
    - Body `{"error": "Not found"}`
  - Direct calls to `POST /api/filters/preview` also returned `404 Not Found`.
  - No segments exist in `public.segments` with `description like 'EXA Web Search:%'` or with an obviously EXA-style empty `filter_definition` from prior runs.

Because the live adapter used during this run does **not** expose `POST /api/segments/exa`, it is not possible (from within this environment) to:

- Persist a new EXA segment via the `saveExaSegment` code path, or
- Verify immediate `segment_members` creation, duplicate detection by domain/email, or EXA-specific snapshot metadata (e.g. `{ source: 'exa', query: '…' }`) end-to-end.

The enrichment side of the pipeline (jobs + research columns) is already validated via T029; T030’s missing piece here is specifically the EXA segment creation and duplicate detection behavior behind `/api/segments/exa`.

#### T030 Status (this run)

- [ ] EXA search executed successfully and persisted via `/api/segments/exa` – **blocked** in this environment (`404 Not Found` from the live adapter).
- [ ] EXA segment with empty `filter_definition` and immediate `segment_members` verified – **not executed** (no persisted EXA segments).
- [ ] Duplicate detection (domain/email) verified on EXA `segment_members` – **not executed**.
- [ ] Enrichment job for an EXA segment – **not executed** due to missing persisted EXA segment.
- [ ] Web UI enrichment status for an EXA segment – **not executed**.

**Notes**:
- The repository’s `src/web/server.ts` implements `POST /api/segments/exa`, but the adapter instance at `http://localhost:8787/api` in this run appears to be from an older or different build that does not include that route.
- Once the running adapter and the repo version are aligned (and EXA credentials configured), this plan should be re-run to validate T030 end-to-end. The enrichment flow itself is already covered via T029; the remaining risk is limited to EXA segment creation and duplicate-detection logic.

---

## Conclusion (2025-12-17 Run)

- T029 (filter-based segments) is **functionally validated** against the live database and CLI for a real, populated position value. The enrichment pipeline (snapshot → jobs → research columns) behaves as specified once filters match data.
- UI wiring for the Segment step and SegmentBuilder modal is present, but filter preview and EXA segment persistence are currently blocked in this environment by missing endpoints on the running web adapter.
- T030 (EXA segments) remains **partially unvalidated** here: the UI is wired, but `/api/segments/exa` is not reachable on the live adapter, so EXA segments cannot be created and enriched end-to-end from this agent’s vantage point. Once the adapter exposes that endpoint, this plan can be re-run with the existing Playwright specs (`web/e2e/segment-exa-search.spec.ts`, `web/e2e/segment-enrichment.spec.ts`) and the SQL checks above.
