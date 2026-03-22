# E2E Tests - Segment Creation Workflows

End-to-end tests for the AI-Assisted Segment Builder & EXA Webset Integration feature.

## Test Files

- `segment-filter-based.spec.ts` - T029: Filter-based segment creation workflow
- `segment-exa-search.spec.ts` - T030: EXA web search segment creation workflow
- `helpers.ts` - Common utilities for E2E tests

## Prerequisites

### 1. Install Dependencies

```bash
cd web
pnpm install
pnpm exec playwright install chromium
```

### 2. Environment Setup

Ensure you have:
- Supabase database running
- All migrations applied: `supabase db push`
- Test data in database (companies, employees)
- `.env` file configured with database credentials

### 3. Backend Server Running

Start the backend API server:

```bash
# From project root
pnpm dev:web:live
```

The backend should be running on `http://localhost:8787/api`, and the daily Vite UI should stay on `http://localhost:5173`.

## Running E2E Tests

### Run All E2E Tests (Headless)

```bash
cd web
pnpm test:e2e
```

### Run with UI Mode (Interactive)

```bash
cd web
pnpm test:e2e:ui
```

This opens Playwright's interactive UI where you can:
- See tests running in real-time
- Inspect DOM elements
- Debug test failures
- Re-run individual tests

### Run in Headed Mode (See Browser)

```bash
cd web
pnpm test:e2e:headed
```

### Debug Mode (Step Through Tests)

```bash
cd web
pnpm test:e2e:debug
```

### Run Specific Test File

```bash
cd web
pnpm exec playwright test segment-filter-based.spec.ts
```

### View Test Report

After running tests, view the HTML report:

```bash
cd web
pnpm test:e2e:report
```

## Test Scenarios

### T029: Filter-Based Segment

Tests the complete workflow:
1. Open SegmentBuilder modal
2. Add filter (field, operator, value)
3. Preview filter results
4. Create segment
5. Verify segment appears in list

**Test Cases:**
- ✅ Create filter-based segment successfully
- ✅ Validate empty segment name error
- ✅ Display filter preview counts

### T030: EXA Web Search Segment

Tests the complete workflow:
1. Open EXA Web Search modal
2. Enter search description
3. Execute search
4. View results (Companies/Employees tabs)
5. Save as segment
6. Verify segment appears in list

**Test Cases:**
- ✅ Open EXA search modal
- ✅ Perform search and display results
- ✅ Save segment with results
- ✅ Validate empty segment name error
- ✅ Close modal (Cancel/X button)

## Configuration

### Playwright Config (`playwright.config.ts`)

- **Browser**: Chromium (Desktop Chrome)
- **Base URL**: http://localhost:5173
- **Validation ports only**: use adapter `8888` + UI `5174` for isolated browser checks, not for daily work
- **Workers**: 1 (sequential execution to avoid DB conflicts)
- **Retries**: 0 (local), 2 (CI)
- **Auto-start dev server**: Yes (pnpm dev)

### Environment Variables

For EXA tests that require API access:

```bash
export EXA_API_KEY="your-exa-api-key"
```

Tests will skip EXA API calls if the key is not set.

## Debugging Tips

### 1. Screenshot on Failure

Playwright automatically captures screenshots on test failure.
Find them in: `web/test-results/`

### 2. Video Recording

Videos are recorded for failed tests.
Find them in: `web/test-results/`

### 3. Trace Viewer

If a test fails, you can view the trace:

```bash
pnpm exec playwright show-trace test-results/path-to-trace.zip
```

### 4. Slow Motion Mode

Run tests in slow motion to see what's happening:

```bash
pnpm exec playwright test --headed --slow-mo=1000
```

### 5. Console Logs

Tests capture browser console logs. Check test output for:

```
console.log: Segment created successfully: Test CTOs
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Install Playwright
  run: cd web && pnpm exec playwright install --with-deps chromium

- name: Run E2E Tests
  run: cd web && pnpm test:e2e
  env:
    CI: true
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: web/playwright-report/
```

## Troubleshooting

### Issue: "Browser not found"

Run browser installation:

```bash
pnpm exec playwright install chromium
```

### Issue: "Web server not ready"

Ensure backend is running:

```bash
pnpm dev:web:live
```

### Issue: "No test data"

Seed your database with test data:

```sql
-- Add test companies
INSERT INTO companies (company_name, website, country)
VALUES ('Test Corp', 'test.com', 'US');

-- Add test employees
INSERT INTO employees (full_name, work_email, position, company_id)
VALUES ('John Doe', 'john@test.com', 'CTO', '<company-id>');
```

### Issue: "Timeout waiting for element"

Increase timeout in test or check if element selector is correct:

```typescript
await page.waitForSelector('text=Segment', { timeout: 10000 });
```

## Test Coverage

Current E2E test coverage:
- ✅ Filter-based segment creation (T029)
- ✅ EXA web search segment creation (T030)
- ✅ Modal interactions
- ✅ Form validation
- ✅ Results display

Future test coverage:
- ⏳ Segment snapshot workflow (CLI)
- ⏳ Enrichment workflow (CLI)
- ⏳ AI filter suggestions
- ⏳ Segment list refresh
- ⏳ Duplicate detection verification

## MCP Integration

Playwright is configured as an MCP server in `.mcp.json`:

```json
{
  "playwright": {
    "command": "npx",
    "args": ["-y", "@playwright/test"]
  }
}
```

This allows Claude Code to interact with Playwright tests through the MCP protocol.

## Related Documentation

- [E2E Test Plan](../../specs/001-segment-search/e2e-test-plan.md) - Full manual test plan
- [Feature Spec](../../specs/001-segment-search/spec.md) - Feature specification
- [Tasks](../../specs/001-segment-search/tasks.md) - Implementation tasks
