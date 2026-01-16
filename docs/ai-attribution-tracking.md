# AI Attribution Tracking for Segment Creation

## Overview

The segment creation endpoint (`POST /api/segments`) now supports optional AI attribution metadata to track when segments are created from AI-generated filter suggestions. This enables analytics on AI usage patterns and prompt improvement.

## Request Format

When creating a segment via AI assistance, include the `aiAttribution` field in the request body:

```typescript
POST /api/segments
{
  "name": "Enterprise CTOs",
  "locale": "en",
  "filterDefinition": [
    { "field": "employees.role", "operator": "eq", "value": "CTO" },
    { "field": "companies.employees", "operator": "gte", "value": 50 }
  ],
  "description": "AI-suggested segment for CTOs",
  "aiAttribution": {
    "suggestionId": "sugg-abc123",
    "userDescription": "Target CTOs at AI companies with 50+ employees"
  }
}
```

### AI Attribution Fields

- `suggestionId` (string): Unique identifier for the AI suggestion that was accepted
- `userDescription` (string): Original user input that prompted the AI suggestion

## Current Implementation

**Status**: Logging-based (v1.0)

When `aiAttribution` is provided, the system:
1. Validates the segment creation request normally
2. Creates the segment in the database
3. Logs attribution metadata to console for analytics

### Log Format

```json
{
  "segmentId": "uuid-of-created-segment",
  "segmentName": "Enterprise CTOs",
  "suggestionId": "sugg-abc123",
  "userDescription": "Target CTOs at AI companies with 50+ employees",
  "timestamp": "2025-12-17T10:38:02.090Z"
}
```

## Future Migration Plan

### Phase 2: Database Storage

When ready to persist attribution metadata, add a `metadata` JSONB column to the `segments` table:

```sql
-- Migration: add_segment_metadata.sql
ALTER TABLE public.segments
ADD COLUMN metadata JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS segments_metadata_idx
ON public.segments USING gin (metadata);
```

### Phase 3: Service Layer Updates

Update `src/services/segments.ts` to accept and store metadata:

```typescript
export interface SegmentInput {
  name: string;
  locale: string;
  filterDefinition: Record<string, unknown>;
  description?: string;
  createdBy?: string;
  metadata?: {
    aiAttribution?: {
      usedAI: boolean;
      suggestionId?: string;
      userDescription?: string;
      timestamp: string;
    };
  };
}

export async function createSegment(
  client: SupabaseClient,
  input: SegmentInput
): Promise<Record<string, any>> {
  const { data, error } = await client
    .from('segments')
    .insert([
      {
        name: input.name,
        locale: input.locale,
        filter_definition: input.filterDefinition,
        description: input.description,
        created_by: input.createdBy,
        metadata: input.metadata,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Record<string, any>;
}
```

### Phase 4: Analytics Integration

Once stored in the database, attribution data can be queried for:

- **Usage metrics**: Percentage of segments created via AI vs. manual
- **Prompt effectiveness**: Correlation between suggestions and segment adoption
- **User patterns**: Which types of descriptions lead to best suggestions
- **A/B testing**: Compare different prompt versions by tracking `suggestionId`

Example analytics query:

```sql
SELECT
  COUNT(*) FILTER (WHERE metadata->'aiAttribution'->>'usedAI' = 'true') AS ai_assisted,
  COUNT(*) FILTER (WHERE metadata->'aiAttribution'->>'usedAI' IS NULL) AS manual,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->'aiAttribution'->>'usedAI' = 'true') / COUNT(*), 2) AS ai_adoption_rate
FROM segments
WHERE created_at >= NOW() - INTERVAL '30 days';
```

## Backward Compatibility

- The `aiAttribution` field is **optional**
- Segments created without it will work exactly as before
- No breaking changes to existing segment creation flows
- Graceful degradation if logging fails (attribution is logged, not stored)

## Testing

Tests are located in `src/web/server.test.ts`:

- `accepts and logs AI attribution metadata when creating segments`: Verifies attribution logging
- `does not log attribution when aiAttribution is not provided`: Ensures backward compatibility

Run tests with:
```bash
pnpm test src/web/server.test.ts
```

## Related Files

- `src/web/server.ts`: POST /api/segments endpoint implementation
- `src/services/segments.ts`: Service layer for segment creation
- `src/web/server.test.ts`: Test coverage for AI attribution
- `supabase/migrations/20251121211952_2025-11-21_create_spine_tables.sql`: Segments table schema

## See Also

- AI filter suggestion endpoint: `POST /api/filters/ai-suggest`
- Segment filtering documentation: `src/filters/index.ts`
- ICP coach integration: `src/services/icpCoach.ts`
