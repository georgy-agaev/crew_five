import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type FilterOp = 'eq' | 'in' | 'not_in' | 'gte' | 'lte' | 'contains';

export interface FilterClause {
  field: string;
  op: FilterOp;
  value: unknown;
}

type FieldScope = 'employees' | 'companies';

const allowedFields: Record<string, { scope: FieldScope; column: string }> = {
  // Employee-level filters
  'employees.id': { scope: 'employees', column: 'id' },
  'employees.role': { scope: 'employees', column: 'position' },
  'employees.position': { scope: 'employees', column: 'position' },
  'employees.processing_status': { scope: 'employees', column: 'processing_status' },
  'employees.work_email_status': { scope: 'employees', column: 'work_email_status' },
  'employees.generic_email_status': { scope: 'employees', column: 'generic_email_status' },

  // Company-level filters
  'companies.segment': { scope: 'companies', column: 'segment' },
  'companies.employee_count': { scope: 'companies', column: 'employee_count' },
  'companies.office_qualification': { scope: 'companies', column: 'office_qualification' },
};

const allowedFieldNames = Object.keys(allowedFields);
const allowedOps: FilterOp[] = ['eq', 'in', 'not_in', 'gte', 'lte', 'contains'];
const legacyFieldAliases: Record<string, string> = {
  id: 'employees.id',
  employee_count: 'companies.employee_count',
  office_qualification: 'companies.office_qualification',
  processing_status: 'employees.processing_status',
};

function ensureFieldAllowed(field: string) {
  if (!allowedFields[field]) {
    throw new Error(`Unknown field: ${field}. Allowed fields: ${allowedFieldNames.join(', ')}`);
  }
}

function normalizeFilterField(field: string): string {
  return legacyFieldAliases[field] ?? field;
}

function mapFilterFieldToSupabaseColumn(field: string): string {
  const config = allowedFields[field];
  if (!config) {
    ensureFieldAllowed(field);
    // ensureFieldAllowed will throw, but return is required for type narrowing
    return field;
  }

  if (config.scope === 'employees') {
    return config.column;
  }
  // For company scope, apply filters via embedded `company` relationship
  return `company.${config.column}`;
}

export function parseSegmentFilters(definition: unknown): FilterClause[] {
  if (!Array.isArray(definition) || definition.length === 0) {
    throw new Error('filter_definition must contain at least one filter');
  }

  return definition.map((clause, idx) => {
    if (
      !clause ||
      typeof clause !== 'object' ||
      typeof (clause as any).field !== 'string' ||
      (typeof (clause as any).operator !== 'string' && typeof (clause as any).op !== 'string')
    ) {
      throw new Error(`Invalid filter clause at index ${idx}`);
    }

    const { value } = clause as {
      field: string;
      operator?: FilterOp;
      op?: FilterOp;
      value: unknown;
    };
    const field = normalizeFilterField((clause as any).field);
    const operator = ((clause as any).operator ?? (clause as any).op) as FilterOp;

    ensureFieldAllowed(field);

    if (!allowedOps.includes(operator)) {
      throw new Error(`Unsupported operator: ${operator}. Allowed: ${allowedOps.join(', ')}`);
    }

    if ((operator === 'in' || operator === 'not_in') && (!Array.isArray(value) || value.length === 0)) {
      throw new Error(`Operator ${operator} requires a non-empty array value`);
    }

    if ((operator === 'gte' || operator === 'lte') && typeof value !== 'number') {
      throw new Error(`Operator ${operator} requires a numeric value`);
    }

    if (operator === 'contains' && typeof value !== 'string') {
      throw new Error(`Operator ${operator} requires a string value`);
    }

    return { field, op: operator, value };
  });
}

export function validateFilters(
  definition: unknown
): { ok: true; filters: FilterClause[] } | { ok: false; error: { code?: string; message: string; details?: Record<string, unknown> } } {
  try {
    const filters = parseSegmentFilters(definition);
    return { ok: true, filters };
  } catch (error: any) {
    return {
      ok: false,
      error: {
        code: 'ERR_FILTER_VALIDATION',
        message: error?.message ?? 'Invalid filters',
        details: {
          allowedOperators: allowedOps,
          allowedFields: allowedFieldNames,
        },
      },
    };
  }
}

export function hashFilters(filters: FilterClause[]): string {
  const normalized = filters.map((f) => ({ field: f.field, op: f.op, value: f.value }));
  const serialized = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export function buildContactQuery(client: SupabaseClient, filters: FilterClause[]) {
  let query: any = client
    .from('employees')
    .select(
      [
        'id',
        'company_id',
        'full_name',
        'work_email',
        'position',
        'company:companies(id, company_name, company_description, website, employee_count, region, office_qualification, segment, company_research)',
      ].join(', ')
    );

  for (const filter of filters) {
    const column = mapFilterFieldToSupabaseColumn(filter.field);
    if (filter.op === 'eq') {
      query = query.eq(column, filter.value);
    } else if (filter.op === 'in') {
      query = query.in(column, filter.value as any[]);
    } else if (filter.op === 'not_in') {
      query = query.not(column, 'in', filter.value as any[]);
    } else if (filter.op === 'gte') {
      query = query.gte(column, filter.value as number);
    } else if (filter.op === 'lte') {
      query = query.lte(column, filter.value as number);
    } else if (filter.op === 'contains') {
      const pattern = `%${String(filter.value)}%`;
      query = query.ilike(column, pattern);
    }
  }

  return query;
}
