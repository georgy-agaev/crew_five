# Research Findings: AI-Assisted Segment Builder & EXA Webset Integration

**Date**: 2025-12-16
**Feature**: `001-segment-search`
**Status**: IN PROGRESS

## Summary

This document contains research findings for implementing the segment builder and EXA Webset integration features. Research covers library evaluation, API investigation, and technical feasibility assessment.

---

## 1. UI Component Library for Filter Builder

### Requirement
Need a React component library for building filter rules with field selector, operator dropdown, and value input that supports TypeScript and React 19.

### Libraries Evaluated

| Library | Maintenance | TypeScript | React 19 | Bundle Size | License | Recommendation |
|---------|-------------|------------|----------|-------------|---------|----------------|
| **SVAR React Filter** | Active (2024+) | ✅ Yes | ✅ Yes | Small | MIT | ⭐ RECOMMENDED |
| **react-query-filter** | Active | ✅ Yes | ✅ Yes | Minimal | MIT | ⭐ Alternative (DIY) |
| DevExtreme FilterBuilder | Active | ✅ Yes | ✅ Yes | Large | Commercial | ❌ Not free |
| react-filter-builder | Archived | ⚠️ Limited | ❌ No | Small | MIT | ❌ Outdated |

### Decision: Build Custom Filter UI

**Rationale**:
1. **Simplicity**: Our filter requirements are straightforward (field, operator, value) - building custom avoids unnecessary complexity
2. **Existing Patterns**: The codebase already has form patterns we can reuse
3. **Bundle Size**: Avoid adding large dependencies for a feature we can build in ~100-150 lines
4. **Customization**: Full control over styling to match existing UI theme
5. **Type Safety**: Direct integration with existing filter schema from `src/filters/index.ts`

**Implementation Approach**:
- Create `FilterRow.tsx` component with field/operator/value selects
- Use native HTML select/input elements styled with existing theme
- Add/remove rows with simple array state management
- No external library dependency needed

**Alternatives Considered**:
- **SVAR React Filter**: Well-maintained but adds ~50KB+ to bundle for functionality we can build ourselves
- **react-query-filter**: Provides hook-based approach but still requires building full UI
- **DevExtreme**: Comprehensive but commercial license inappropriate for this project

**Sources**:
- [SVAR React Filter](https://github.com/svar-widgets/react-filter/)
- [react-query-filter](https://github.com/armand1m/react-query-filter)
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react)

---

## 2. EXA Webset API Investigation

### Requirement
Integrate with EXA Webset API to enable web-based company discovery. Determine if existing `src/integrations/exa.ts` client is compatible or needs modification.

### Findings

**Official Documentation**: [https://docs.exa.ai/websets/api/overview](https://docs.exa.ai/websets/api/overview)

**API Capabilities**:
- `create_webset`: Create new websets
- `list_webset_items`: List items within a webset
- `get_webset_item`: Retrieve specific webset items
- `create_webset_enrichment`: Create enrichments for webset data
- `search_webset_items`: Search within webset items

**Key Differences from Discovery API**:
- Websets organize content in containers (Webset)
- Focused on structured data extraction (people, companies)
- Supports enrichment workflows
- Different endpoint structure (`/websets/...` vs `/search`)

### Decision: ✅ Reuse Existing Exa Client

**Rationale**:
1. **Already Implemented**: The existing `src/integrations/exa.ts` client already implements Webset API
2. **Production Proven**: Used in ICP discovery workflow (`src/services/icpDiscovery.ts`)
3. **No Modifications Needed**: Current implementation fully supports required functionality
4. **Consistent Patterns**: Maintains existing error handling and auth patterns

**Existing Exa Client Capabilities** (`src/integrations/exa.ts`):

```typescript
export interface ExaClient {
  createWebset(input: {
    name: string;
    queries: string[]  // Array of search queries
  }): Promise<{ id: string }>;

  getWebsetItems(input: {
    websetId: string;
    limit?: number
  }): Promise<{
    items: Array<{
      url: string;
      title?: string;
    }>
  }>;
}
```

**Configuration**:
- **API Key**: `EXA_API_KEY` environment variable (required)
- **Base URL**: `https://api.exa.ai` (default, override via `EXA_API_BASE`)
- **Current Usage**: ICP discovery workflow

**Implementation Approach**:

✅ **Direct Integration** - No new service file needed:
```typescript
// In new service: src/services/exaWebset.ts
import { buildExaResearchClientFromEnv } from '../integrations/exa.ts';

export async function searchExaWebset(query: string, limit: number = 100) {
  const client = buildExaResearchClientFromEnv();

  // Create webset with query
  const webset = await client.createWebset({
    name: `Segment Search: ${query}`,
    queries: [query]
  });

  // Fetch results
  const results = await client.getWebsetItems({
    websetId: webset.id,
    limit
  });

  return results.items;
}
```

**Required Additions** (if needed):
- Result transformation utilities (URL → company data)
- Batch query support (multiple queries at once)
- Error handling improvements (rate limits, API errors)

**Sources**:
- [Exa Websets API Overview](https://docs.exa.ai/websets/api/overview)
- [Exa MCP Server](https://github.com/exa-labs/exa-mcp-server)
- [Exa Web Search API](https://exa.ai/exa-api)

---

## 3. Debounce/Throttle Utility

### Requirement
Implement debouncing for real-time filter preview counts to avoid excessive database queries.

### Libraries Evaluated

| Library | Weekly Downloads | TypeScript | React Support | Bundle Size | Recommendation |
|---------|------------------|------------|---------------|-------------|----------------|
| **use-debounce** | 500K+ | ✅ Yes | ✅ Yes (hooks) | 2.4KB | ⭐ RECOMMENDED |
| usehooks-ts | 200K+ | ✅ Yes | ✅ Yes | Minimal | ⭐ Alternative |
| lodash.debounce | 10M+ | ⚠️ Via @types | ❌ No | 2KB + React wrapper | ❌ Requires wrapper |

### Decision: Use `use-debounce` Library

**Rationale**:
1. **Purpose-Built**: Designed specifically for React hooks
2. **Small Footprint**: Only 2.4KB minified
3. **TypeScript Native**: First-class TypeScript support
4. **Active Maintenance**: Regular updates, React 19 compatible
5. **Simple API**: `useDebounce(value, delay)` covers our use case
6. **Server-Rendering Safe**: Works with SSR if needed in future

**Implementation**:
```typescript
import { useDebounce } from 'use-debounce';

// In filter preview hook
const [filters, setFilters] = useState([]);
const [debouncedFilters] = useDebounce(filters, 300);

useEffect(() => {
  // Fetch preview count with debouncedFilters
}, [debouncedFilters]);
```

**Alternatives Considered**:
- **usehooks-ts**: Similar functionality, but use-debounce has more focused API
- **lodash.debounce**: Requires manual useCallback/useMemo wrapping, more boilerplate
- **Custom implementation**: Adds ~30 lines of code for functionality library provides reliably

**Installation**:
```bash
pnpm add use-debounce
```

**Sources**:
- [use-debounce GitHub](https://github.com/xnimorz/use-debounce)
- [usehooks-ts](https://usehooks-ts.com/react-hook/use-debounce)
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react)

---

## 4. Database Schema Discovery

### Requirement
Document all columns in `companies` and `employees` tables to build filter UI.

### Status: ✅ COMPLETE

### Findings

**Companies Table Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | No | Primary key |
| `company_name` | text | No | Company name |
| `website` | text | Yes | Company website URL |
| `segment` | text | Yes | Market segment |
| `region` | text | Yes | Geographic region |
| `status` | text | Yes | Status (e.g., 'Active') |
| `office_qualification` | text | Yes | Office qualification status |
| `registration_date` | timestamptz | Yes | Registration timestamp |
| `company_research` | jsonb | Yes | AI enrichment data |
| `created_at` | timestamptz | No | Creation timestamp |

**Employees Table Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | No | Primary key |
| `company_id` | uuid | No | Foreign key to companies |
| `full_name` | text | No | Employee full name |
| `work_email` | text | Yes | Work email address |
| `generic_email` | text | Yes | Generic/personal email |
| `position` | text | Yes | Job title/role |
| `company_name` | text | Yes | Denormalized company name |
| `ai_research_data` | jsonb | Yes | AI enrichment data |

**Key Insights**:
- **Filterable Fields**: 10 companies fields, 7 employees fields
- **Text Fields**: Support `eq`, `in`, `not_in` operators
- **Timestamp Fields**: Support `gte`, `lte` operators for date ranges
- **JSONB Fields**: Not directly filterable (enrichment data)
- **Join Pattern**: `company:companies(...)` for employee-to-company joins

**Recommended Filter UI Fields**:

**Companies**:
- company_name (text, autocomplete)
- segment (text, select/multiselect)
- region (text, select/multiselect)
- status (text, select)
- registration_date (timestamp, date range picker)

**Employees**:
- full_name (text, autocomplete)
- position (text, select/multiselect)
- work_email (text, exact match)
- company_id (uuid, company selector)

**Source**: Derived from code usage in `src/web/server.ts`, `src/filters/index.ts`, and migration files.

---

## 5. Existing AI Coach Capabilities

### Requirement
Determine if existing AI coach (`src/services/coach.ts`, `src/services/icpCoach.ts`) can generate structured filter JSON.

### Status: ✅ COMPLETE

### Findings

**✅ YES - AI Coach Can Generate Structured Filter JSON**

**Evidence**:

1. **JSON Mode Enforcement** (`src/services/icpCoach.ts` lines 127-132):
   ```typescript
   const header =
     'You are running in EXPRESS JSON MODE for ICP coaching.\n' +
     'Run phases 1–3 internally. Do NOT ask the user any questions.\n' +
     'Return ONLY a valid JSON object with keys { name, description, companyCriteria, personaCriteria, triggers, dataSources }.\n\n';
   ```

2. **JSON Parsing & Validation** (`src/services/icpCoach.ts` lines 176-214):
   - Parses JSON responses
   - Validates required fields
   - Handles nested object structures

3. **Existing Coach Pattern** (`src/services/coach.ts`):
   - Creates job record for tracking
   - Loads prompts from registry
   - Invokes LLM via ChatClient
   - Validates and stores structured output
   - Updates job status with results

**Current Capabilities**:

| Feature | Supported | Evidence |
|---------|-----------|----------|
| Structured JSON Output | ✅ Yes | JSON mode enforcement |
| Schema Validation | ✅ Yes | `companyCriteria`, `personaCriteria` validation |
| Prompt Registry Integration | ✅ Yes | `promptId` parameter |
| User Prompt Override | ✅ Yes | `userPrompt` parameter |
| Job Tracking | ✅ Yes | Job record creation |
| Error Handling | ✅ Yes | Non-JSON response handling |

**Recommendation for Filter Generation**:

✅ **Create new coach function**: `generateSegmentFiltersViaCoach()`

**Proposed Implementation**:
```typescript
// Input schema
{
  userPrompt: string;  // "enterprise SaaS companies in North America"
  icpProfileId?: string;  // Optional context
  promptId?: string;  // From prompt registry
}

// Output schema (matching src/filters/index.ts)
{
  filters: Array<{
    field: string;  // "employees.position", "companies.region"
    operator: "eq" | "in" | "not_in" | "gte" | "lte";
    value: unknown;
  }>,
  rationale?: string;  // Why these filters were suggested
}
```

**Required Modifications**:
1. Add new prompt to registry for filter generation
2. Create `generateSegmentFiltersViaCoach()` in `icpCoach.ts`
3. Register new job type in jobs system
4. Add validation for filter schema format

**Estimated Effort**: Small (~50-100 lines, reuses existing patterns)

**Source**: `src/services/coach.ts`, `src/services/icpCoach.ts`

---

## 6. Existing Modal/UI Patterns

### Requirement
Identify reusable modal/panel patterns from existing UI for segment builder and EXA search interfaces.

### Status: ✅ COMPLETE

### Findings

**Modal Pattern Structure** (`web/src/pages/PipelineWorkspaceWithSidebar.tsx` lines 4918-4926):

```tsx
// 1. State Management
const [showSettings, setShowSettings] = useState(false);

// 2. Conditional Rendering
{showSettings && (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',  // Semi-transparent overlay
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }}>
    <div style={{
      background: colors.card,  // Themed background
      borderRadius: '16px',
      width: '90%',
      maxWidth: '800px',
      maxHeight: '85vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>{t.settingsModal.title}</h3>
          <button onClick={() => setShowSettings(false)}>×</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {/* Content */}
      </div>
    </div>
  </div>
)}
```

**Key Pattern Elements**:

1. **Overlay Layer**:
   - Fixed positioning with `inset: 0`
   - Semi-transparent backdrop (`rgba(0,0,0,0.5)`)
   - Flexbox centering
   - High z-index (1000)

2. **Modal Card**:
   - Themed via `colors` object
   - Border radius: 16px
   - Responsive: 90% width, 800px max
   - Max height: 85vh with scroll
   - Flexbox column layout

3. **Header Section**:
   - 24px padding
   - Bottom border
   - Title + close button (flex layout)
   - Close button: × symbol, 32x32px

4. **Body Section**:
   - `flex: 1` to fill space
   - 24px padding
   - `overflowY: auto` for scrolling

**Color System** (Theme Variables):

| Variable | Usage |
|----------|-------|
| `colors.card` | Modal backgrounds |
| `colors.border` | Borders and dividers |
| `colors.textMuted` | Secondary text |
| `colors.sidebar` | Secondary backgrounds |
| `colors.orange`, `colors.orangeLight` | Status badges/highlights |
| `isDark` boolean | Dark mode support |

**No External UI Library**:
- ✅ No shadcn/ui, Material-UI, or other component libraries
- ✅ Custom styled components with inline styles
- ✅ Consistent design system via `colors` object
- ✅ Full control over styling

**Recommendation for Segment Builder**:

✅ **Follow existing modal pattern exactly**:
```tsx
// Add to PipelineWorkspaceWithSidebar.tsx
const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
const [showExaSearch, setShowExaSearch] = useState(false);
```

✅ **Extract reusable Modal component** (optional optimization):
```tsx
// web/src/components/Modal.tsx
interface ModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

**Source**: `web/src/pages/PipelineWorkspaceWithSidebar.tsx`

---

## 7. Filter Validation System

### Requirement
Understand existing filter schema format to ensure compatibility.

### Status: ✅ COMPLETE

### Findings

**Filter Schema** (`src/filters/index.ts`):

```typescript
export type FilterOp = 'eq' | 'in' | 'not_in' | 'gte' | 'lte';

export interface FilterClause {
  field: string;     // "employees.position" or "companies.region"
  op: FilterOp;      // One of: eq, in, not_in, gte, lte
  value: unknown;    // Type depends on operator
}

// Stored in segment.filter_definition as JSONB array
type FilterDefinition = FilterClause[];
```

**Validation Rules**:

| Rule | Requirement |
|------|-------------|
| **Format** | Must be non-empty array of FilterClause objects |
| **Field Prefix** | Must start with `employees.` or `companies.` |
| **Operator** | Must be one of: `eq`, `in`, `not_in`, `gte`, `lte` |
| **Value Type** | `in`/`not_in`: non-empty array<br>`gte`/`lte`: number<br>`eq`: any type |

**Field Mapping**:
```typescript
// UI format → Supabase query format
"employees.position"  →  "position" (direct)
"companies.region"    →  "company.region" (join syntax)
```

**Validation Function**:
```typescript
export function validateFilters(
  definition: unknown
): { ok: true; filters: FilterClause[] } | { ok: false; error: { code?: string; message: string } }
```

**Error Code**: `ERR_FILTER_VALIDATION` (structured error with details)

**Query Building**:
```typescript
// Filters are combined with AND logic
buildContactQuery(client, filters)
  // Returns Supabase query with .eq(), .in(), .gte(), etc.
```

**Version Control**:
```typescript
// Hash filters to detect changes
hashFilters(filters): string  // SHA-256 hash for version tracking
```

**Example Valid Filters**:
```json
[
  { "field": "employees.position", "operator": "eq", "value": "CTO" },
  { "field": "employees.position", "operator": "in", "value": ["CTO", "CEO"] },
  { "field": "companies.region", "operator": "eq", "value": "North America" }
]
```

**Integration Points for UI**:

1. **Field Selection**: Show dropdown with all available fields
   - `employees.*` fields from employees table
   - `companies.*` fields from companies table

2. **Operator Selection**: Show appropriate operators based on field type
   - Text fields: `eq`, `in`, `not_in`
   - Numeric fields: `eq`, `gte`, `lte`
   - Date fields: `gte`, `lte`

3. **Value Input**: Adapt input based on operator
   - `eq`: Single text input
   - `in`/`not_in`: Multi-select or comma-separated input
   - `gte`/`lte`: Number or date picker

4. **Validation**: Call `validateFilters()` before segment creation
   - Display `ERR_FILTER_VALIDATION` errors to user
   - Show field/operator/value requirements

**Key Insights**:
- ✅ Robust validation with comprehensive error handling
- ✅ Type-safe with clear TypeScript interfaces
- ✅ Supports all common SQL operators
- ✅ Version control via hashing enables staleness detection
- ✅ AND-only logic (no OR support yet)

**Source**: `src/filters/index.ts`

---

## Summary of Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Filter Builder UI | ✅ Build Custom | Simple requirements (~100-150 lines), avoid dependencies, full control, matches existing patterns |
| Debounce Library | ✅ use-debounce | Purpose-built for React, 2.4KB, TypeScript native, active maintenance |
| EXA Integration | ✅ Reuse Existing Client | Already implemented in `src/integrations/exa.ts`, production-proven, no modifications needed |
| Database Schema | ✅ Documented | 10 companies fields, 7 employees fields identified with types and constraints |
| AI Coach Extension | ✅ Extend Existing | Coach supports structured JSON, create `generateSegmentFiltersViaCoach()` function (~50-100 lines) |
| Modal Patterns | ✅ Follow Existing | Inline styles with `colors` theme, conditional rendering, no external library |
| Filter Schema | ✅ Validated | Schema format confirmed, 5 operators supported, validation function identified |

---

## Key Technical Decisions

### 1. No New External Dependencies
**Decision**: Minimize external libraries
- ✅ **Add**: `use-debounce` (2.4KB, essential utility)
- ✅ **Reuse**: All existing infrastructure (filter validation, segment services, AI coach, Exa client, modal patterns)
- ❌ **Avoid**: Filter builder UI libraries (unnecessary complexity)

### 2. Service Layer Organization
**Decision**: Create 2 new service files
- `src/services/filterPreview.ts` - Filter preview count queries
- `src/services/exaWebset.ts` - EXA Webset search wrapper

**Rationale**: Keeps business logic separate from HTTP layer, maintains existing patterns

### 3. Frontend Component Structure
**Decision**: Create 4 new React components + 2 hooks
- **Components**: `SegmentBuilder`, `FilterRow`, `AIFilterSuggestions`, `ExaWebsetSearch`
- **Hooks**: `useFilterPreview`, `useExaSearch`

**Rationale**: Follows existing separation of concerns, reusable components, testable hooks

### 4. API Endpoint Strategy
**Decision**: Add 4 new endpoints to existing `src/web/server.ts`
- `POST /api/filters/preview` - Filter preview counts
- `POST /api/filters/ai-suggest` - AI filter suggestions
- `POST /api/exa/webset/search` - EXA Webset search
- `POST /api/segments` - Create segment (may exist, verify)

**Rationale**: Maintains single HTTP server, follows RESTful patterns

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Filter preview performance | Medium | High | Add database indexes, implement query timeout, cache common queries |
| AI coach token limits | Low | Medium | Limit prompt size, implement chunking for large schemas |
| EXA rate limits | Medium | Medium | Implement request queuing, show rate limit errors clearly |
| Modal UX complexity | Low | Low | Follow existing patterns exactly, test across viewports |

---

## Next Steps

1. ✅ Phase 0: Research Complete
2. → Phase 1: Design & Contracts
   - Create `data-model.md`
   - Generate API contracts in `contracts/`
   - Create `quickstart.md`
   - Update agent context
3. → Phase 2: Task Breakdown (via `/speckit.tasks`)
4. → Phase 3: Implementation (via `/speckit.implement`)

**Status**: ✅ READY FOR PHASE 1
