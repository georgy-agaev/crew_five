import type { SupabaseClient } from '@supabase/supabase-js';
import { parseSegmentFilters, buildContactQuery } from '../filters/index.js';
import type { FilterClause } from '../filters/index.js';

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

function splitFiltersByScope(filters: FilterClause[]): {
  employeeFilters: FilterClause[];
  companyFilters: FilterClause[];
} {
  const employeeFilters: FilterClause[] = [];
  const companyFilters: FilterClause[] = [];

  for (const filter of filters) {
    if (filter.field.startsWith('companies.')) {
      companyFilters.push(filter);
    } else if (filter.field.startsWith('employees.')) {
      employeeFilters.push(filter);
    } else {
      // Fallback: treat unknown prefixes as employee scope so behaviour
      // doesn’t silently drop filters if the allowlist expands.
      employeeFilters.push(filter);
    }
  }

  return { employeeFilters, companyFilters };
}

function companyRowMatchesFilters(row: any, companyFilters: FilterClause[]): boolean {
  for (const filter of companyFilters) {
    let fieldValue: unknown;
    if (filter.field === 'companies.segment') {
      fieldValue = row.segment;
    } else if (filter.field === 'companies.employee_count') {
      fieldValue = row.employee_count;
    } else {
      // Unknown company field: skip (parseSegmentFilters prevents this in practice)
      continue;
    }

    const value = filter.value as any;

    if (filter.op === 'eq') {
      if (fieldValue !== value) return false;
    } else if (filter.op === 'in') {
      if (!Array.isArray(value) || !value.includes(fieldValue)) return false;
    } else if (filter.op === 'not_in') {
      if (Array.isArray(value) && value.includes(fieldValue)) return false;
    } else if (filter.op === 'gte') {
      if (typeof fieldValue !== 'number' || fieldValue < (value as number)) return false;
    } else if (filter.op === 'lte') {
      if (typeof fieldValue !== 'number' || fieldValue > (value as number)) return false;
    }
  }
  return true;
}

export async function getFilterPreviewCounts(
  client: SupabaseClient,
  filterDefinition: unknown
): Promise<FilterPreviewResult> {
  // Validate filters using existing validation logic
  const filters = parseSegmentFilters(filterDefinition);
  const { employeeFilters, companyFilters } = splitFiltersByScope(filters);

  const baseSelect =
    'id, company_id, full_name, work_email, position, company:companies(id, company_name, segment)';

  // If there are no company-scoped filters, keep the existing single-step path.
  if (companyFilters.length === 0) {
    const employeeQuery = buildContactQuery(client, filters);

    const { count: employeeCount, error: employeeError } = await employeeQuery.select(
      baseSelect,
      {
        count: 'exact',
        head: true,
      }
    );

    if (employeeError) {
      throw new Error(`Failed to count employees: ${employeeError.message}`);
    }

    if (!employeeCount || employeeCount === 0) {
      return {
        companyCount: 0,
        employeeCount: 0,
        totalCount: 0,
      };
    }

    const dataQuery = buildContactQuery(client, filters);
    const { data: employees, error: dataError } = await dataQuery.select(
      'company_id, company:companies(id, company_name, segment)'
    );

    if (dataError) {
      throw new Error(`Failed to fetch employee data: ${dataError.message}`);
    }

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

  // Two-step path when company filters are present.
  // 1) Fetch candidate companies and apply filters in-process.
  const {
    data: allCompanies,
    error: companyError,
  } = await client.from('companies').select('id, segment, employee_count');

  if (companyError) {
    throw new Error(`Failed to fetch company data: ${companyError.message}`);
  }

  const companies = (allCompanies ?? []).filter((row: any) =>
    companyRowMatchesFilters(row, companyFilters)
  );

  const companyIds = Array.from(
    new Set((companies ?? []).map((c: any) => c.id).filter(Boolean))
  );

  if (companyIds.length === 0) {
    return {
      companyCount: 0,
      employeeCount: 0,
      totalCount: 0,
    };
  }

  const matchingCompanyCount = companyIds.length;

  // 2) Count employees that belong to those companies and match any employee-scoped filters.
  let employeeQuery = buildContactQuery(client, employeeFilters);
  employeeQuery = employeeQuery.in('company_id', companyIds);

  const {
    data: employees,
    error: employeeError,
  } = await employeeQuery.select('company_id, company:companies(id, company_name, segment)');

  if (employeeError) {
    throw new Error(`Failed to fetch employee data: ${employeeError.message}`);
  }

  const employeeRows = employees ?? [];
  const employeeCount = employeeRows.length;

  if (employeeCount === 0) {
    return {
      companyCount: matchingCompanyCount,
      employeeCount: 0,
      totalCount: 0,
    };
  }

  const uniqueCompanyIds = new Set(
    employeeRows.map((emp: any) => emp.company_id).filter(Boolean)
  );

  const companyCount = uniqueCompanyIds.size || matchingCompanyCount;
  const totalCount = employeeCount;

  return {
    companyCount,
    employeeCount,
    totalCount,
  };
}
