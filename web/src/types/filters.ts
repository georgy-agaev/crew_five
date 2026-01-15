/**
 * Filter types for segment builder UI
 * Based on backend filter system in src/filters/index.ts
 */

export type FilterOperator = 'eq' | 'in' | 'not_in' | 'gte' | 'lte' | 'contains';

export interface FilterDefinition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterPreviewResult {
  companyCount: number;
  employeeCount: number;
  totalCount: number;
}

export interface FilterValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface FilterSuggestion {
  id: string;
  filters: FilterDefinition[];
  rationale?: string;
  preview?: FilterPreviewResult;
}
