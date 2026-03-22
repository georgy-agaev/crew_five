# Segment Filter Coach

## Overview

The segment filter coach extends the AI coach pattern to generate segment filter configurations from natural language descriptions. This feature helps users quickly create valid filter definitions without manually constructing the JSON filter arrays.

## API Reference

### `generateSegmentFiltersViaCoach`

Generates 1-3 filter configuration suggestions based on user description.

```typescript
import { generateSegmentFiltersViaCoach } from './src/services/icpCoach';
import type { FilterSuggestionRequest } from './src/services/icpCoach';

const request: FilterSuggestionRequest = {
  userDescription: 'Target enterprise CTOs in SaaS companies',
  icpProfileId: 'profile-123', // Optional
  icpContext: 'FinTech companies with 100+ employees', // Optional
  maxSuggestions: 3, // Optional, defaults to 1-3
};

const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);

// Returns:
// [
//   {
//     filters: [
//       { field: 'employees.role', operator: 'eq', value: 'CTO' },
//       { field: 'companies.industry', operator: 'eq', value: 'SaaS' },
//       { field: 'companies.employee_count', operator: 'gte', value: 100 }
//     ],
//     rationale: 'Targets CTOs in enterprise SaaS companies',
//     targetAudience: 'Enterprise technology decision makers in SaaS'
//   }
// ]
```

## Request Parameters

### `FilterSuggestionRequest`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userDescription` | `string` | Yes | Natural language description of target segment |
| `icpProfileId` | `string` | No | Optional ICP profile ID for context |
| `icpContext` | `string` | No | Optional ICP context text to guide generation |
| `maxSuggestions` | `number` | No | Maximum number of suggestions (1-3) |

## Response Format

### `FilterSuggestion`

| Field | Type | Description |
|-------|------|-------------|
| `filters` | `Array<FilterClause>` | Array of filter clauses |
| `rationale` | `string?` | Optional explanation of targeting strategy |
| `targetAudience` | `string?` | Optional description of target audience |

### Filter Clause Structure

```typescript
{
  field: string;      // Must start with 'employees.' or 'companies.'
  operator: string;   // One of: 'eq', 'in', 'not_in', 'gte', 'lte', 'contains'
  value: unknown;     // Type depends on operator
}
```

## Allowed Fields and Operators

### Field Prefixes

- `employees.*` - Employee/contact attributes
  - Examples: `employees.role`, `employees.seniority`, `employees.department`
- `companies.*` - Company attributes
  - Examples: `companies.industry`, `companies.size`, `companies.employee_count`

### Operators

| Operator | Value Type | Description |
|----------|------------|-------------|
| `eq` | `string \| number` | Exact match |
| `in` | `Array<string \| number>` | Value in array |
| `not_in` | `Array<string \| number>` | Value not in array |
| `gte` | `number` | Greater than or equal |
| `lte` | `number` | Less than or equal |
| `contains` | `string` | Case-insensitive substring match (`ILIKE '%value%'`) |

## Usage Examples

### Basic Usage

```typescript
const request = {
  userDescription: 'Target VP-level engineering leaders',
};

const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);
// Returns suggestions targeting VP Engineering, VPs of Product, etc.
```

### With ICP Context

```typescript
const request = {
  userDescription: 'Find decision makers',
  icpContext: 'Mid-market FinTech companies (100-500 employees) in North America',
  maxSuggestions: 2,
};

const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);
// Returns suggestions aligned with ICP context
```

### Multiple Targeting Strategies

```typescript
const request = {
  userDescription: 'Target growing SaaS companies',
  maxSuggestions: 3,
};

const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);
// Returns 3 different approaches:
// 1. C-level executives in Series A+ SaaS
// 2. VP-level in high-growth SaaS (50-500 employees)
// 3. Directors in established SaaS companies (500+ employees)
```

## Integration with Segment Creation

```typescript
import { generateSegmentFiltersViaCoach } from './src/services/icpCoach';
import { validateFilters } from './src/filters';

// 1. Generate filter suggestions
const suggestions = await generateSegmentFiltersViaCoach(chatClient, {
  userDescription: 'Target CTOs in FinTech',
});

// 2. Select a suggestion (e.g., first one)
const selectedFilters = suggestions[0].filters;

// 3. Validate filters
const validation = validateFilters(selectedFilters);
if (!validation.ok) {
  throw new Error(validation.error.message);
}

// 4. Create segment with validated filters
const segmentData = {
  name: 'FinTech CTOs',
  locale: 'en',
  filter_definition: validation.filters,
};

// 5. Insert into database
const { data, error } = await supabase
  .from('segments')
  .insert(segmentData)
  .select();
```

## Error Handling

The coach validates all generated filters and will throw errors if:

- LLM returns invalid JSON
- No suggestions are provided
- Filter fields don't start with `employees.` or `companies.`
- Invalid operators are used
- Value types don't match operator requirements (e.g., non-array for `in`, non-number for `gte`)

```typescript
try {
  const suggestions = await generateSegmentFiltersViaCoach(chatClient, request);
} catch (error) {
  if (error.message.includes('Filter coach returned no suggestions')) {
    // Handle empty response
  } else if (error.message.includes('Invalid field')) {
    // Handle field validation error
  } else if (error.message.includes('Invalid operator')) {
    // Handle operator validation error
  }
}
```

## Implementation Pattern

The filter coach follows the same pattern as existing coach functions:

1. **System Prompt**: Instructs LLM on filter rules and JSON structure
2. **User Message**: Provides description and optional context
3. **JSON Mode**: Forces structured JSON output
4. **Validation**: Strict validation of all filter clauses
5. **Error Handling**: Clear error messages with specific validation failures

## Testing

Comprehensive test coverage in `tests/segmentFilterCoach.test.ts`:

- Valid responses with 1-3 suggestions
- All operator types (eq, in, not_in, gte, lte)
- Both employee and company fields
- Optional rationale and targetAudience
- Validation errors for invalid JSON, fields, operators, and value types
- Edge cases (single filter, complex arrays, maxSuggestions limiting)

Run tests:
```bash
pnpm test segmentFilterCoach.test.ts
```

## Architecture Notes

### Design Decisions

1. **JSON Mode Only**: Unlike profile/hypothesis coach which supports interactive mode, filter generation is JSON-only for predictability
2. **Strict Validation**: All filters are validated against allowed prefixes and operators before returning
3. **Multiple Suggestions**: Returns 1-3 suggestions to give users targeting options
4. **Standalone Function**: Not tied to database, can be used in CLI, Web UI, or API contexts

### Extension Points

The filter coach can be extended to:

- Support custom field definitions from database schema
- Add field-specific validation rules (e.g., valid industries, regions)
- Incorporate historical segment performance data
- Suggest filters based on successful campaigns
- Multi-step refinement with user feedback

## Related Documentation

- `src/filters/index.ts` - Filter validation and query building
- `src/services/icpCoach.ts` - ICP coach implementation patterns
- `src/services/chatClient.ts` - Chat client interface
- `CLAUDE.md` - Segment filtering system overview
