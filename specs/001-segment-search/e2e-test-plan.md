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

## Test Execution Log

### T029: Filter-Based Segment

**Date**: _____________________
**Tester**: ____________________

- [ ] Step 1: Segment created ✅ / ❌
- [ ] Step 2: Snapshot created ✅ / ❌
- [ ] Step 3: Enrichment completed ✅ / ❌
- [ ] Step 4: UI verification ✅ / ❌

**Notes**:
_________________________________________________________________
_________________________________________________________________

### T030: EXA Segment

**Date**: _____________________
**Tester**: ____________________

- [ ] Step 1: Segment created ✅ / ❌
- [ ] Step 2: Enrichment completed (no snapshot) ✅ / ❌
- [ ] Step 3: UI verification ✅ / ❌

**Notes**:
_________________________________________________________________
_________________________________________________________________

---

## Conclusion

Both segment types (filter-based and EXA) should successfully integrate with the existing enrichment workflow. The key difference is that EXA segments are immediately enrichable, while filter-based segments require a snapshot step first.
