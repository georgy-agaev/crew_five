import type { SupabaseClient } from '@supabase/supabase-js';
import { parseSegmentFilters, buildContactQuery } from '../filters';

export interface FilterPreviewResult {
  companyCount: number;
  employeeCount: number;
  totalCount: number;
}

/**
 * Get preview counts for a given filter definition without creating a segment.
 * Useful for validating filters and showing user impact before segment creation.
 *
 * @param client - Supabase client (must have access to employees and companies tables)
 * @param filterDefinition - Array of filter clauses matching the segment filter schema.
 *   Each clause should have: {field: string, operator: FilterOp, value: unknown}
 *   Allowed fields: 'employees.*', 'companies.*'
 *   Allowed operators: 'eq', 'in', 'not_in', 'gte', 'lte'
 *
 * @returns Promise resolving to FilterPreviewResult with:
 *   - companyCount: Number of unique companies matching the filters
 *   - employeeCount: Number of employees matching the filters
 *   - totalCount: Same as employeeCount (kept for consistency)
 *
 * @throws Error if filter validation fails (invalid fields, operators, or values)
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 * import { getFilterPreviewCounts } from './services/filterPreview';
 *
 * const client = createClient(url, key);
 *
 * const filters = [
 *   { field: 'employees.role', operator: 'eq', value: 'CTO' },
 *   { field: 'companies.segment', operator: 'in', value: ['Enterprise', 'SMB'] }
 * ];
 *
 * const result = await getFilterPreviewCounts(client, filters);
 * console.log(`Found ${result.employeeCount} employees across ${result.companyCount} companies`);
 * ```
 *
 * Performance: Optimized to use count queries instead of fetching full data.
 * Target response time: <2 seconds for typical filter sets.
 */
export async function getFilterPreviewCounts(
  client: SupabaseClient,
  filterDefinition: unknown
): Promise<FilterPreviewResult> {
  // Validate filters using existing validation logic
  const filters = parseSegmentFilters(filterDefinition);

  // Build query for employee count using existing buildContactQuery
  const employeeQuery = buildContactQuery(client, filters);

  // Get employee count (use count option for performance)
  const { count: employeeCount, error: employeeError } = await employeeQuery
    .select('*', { count: 'exact', head: true });

  if (employeeError) {
    throw new Error(`Failed to count employees: ${employeeError.message}`);
  }

  // If no employees match, return zero counts
  if (!employeeCount || employeeCount === 0) {
    return {
      companyCount: 0,
      employeeCount: 0,
      totalCount: 0,
    };
  }

  // Get distinct company IDs from matching employees
  // We need to fetch the actual data here to get unique company_ids
  const dataQuery = buildContactQuery(client, filters);
  const { data: employees, error: dataError } = await dataQuery.select('company_id');

  if (dataError) {
    throw new Error(`Failed to fetch employee data: ${dataError.message}`);
  }

  // Extract unique company IDs
  const uniqueCompanyIds = new Set(
    (employees ?? []).map((emp: any) => emp.company_id).filter(Boolean)
  );

  const companyCount = uniqueCompanyIds.size;
  const totalCount = employeeCount;

  return {
    companyCount,
    employeeCount,
    totalCount,
  };
}
