import { describe, expect, it } from 'vitest';

import { buildContactQuery, parseSegmentFilters, validateFilters } from '../src/filters';

describe('parseSegmentFilters', () => {
  it('parses minimal operators and rejects unknown', () => {
    const filters = parseSegmentFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.segment', operator: 'in', value: ['Fintech', 'AI'] },
      { field: 'companies.employee_count', operator: 'gte', value: 50 },
    ]);

    expect(filters).toEqual([
      { field: 'employees.role', op: 'eq', value: 'CTO' },
      { field: 'companies.segment', op: 'in', value: ['Fintech', 'AI'] },
      { field: 'companies.employee_count', op: 'gte', value: 50 },
    ]);

    expect(() => parseSegmentFilters([])).toThrow(/at least one filter/);
    expect(() =>
      parseSegmentFilters([{ field: 'unknown.field', operator: 'eq', value: 'x' }])
    ).toThrow(/Unknown field/);
    expect(() =>
      parseSegmentFilters([{ field: 'employees.role', operator: 'gt', value: 1 }])
    ).toThrow(/Unsupported operator/);
  });

  it('supports contains for string fields', () => {
    const filters = parseSegmentFilters([
      { field: 'employees.position', operator: 'contains', value: 'директор' },
    ]);

    expect(filters).toEqual([
      { field: 'employees.position', op: 'contains', value: 'директор' },
    ]);
  });
});

describe('buildContactQuery', () => {
  it('applies range and list operators to the query', () => {
    const calls: Array<{ method: string; args: any[] }> = [];
    const query = {
      eq: (...args: any[]) => (calls.push({ method: 'eq', args }), query),
      gte: (...args: any[]) => (calls.push({ method: 'gte', args }), query),
      lte: (...args: any[]) => (calls.push({ method: 'lte', args }), query),
      in: (...args: any[]) => (calls.push({ method: 'in', args }), query),
      not: (...args: any[]) => (calls.push({ method: 'not', args }), query),
      ilike: (...args: any[]) => (calls.push({ method: 'ilike', args }), query),
    };
    const client = {
      from: () => ({
        select: () => query,
      }),
    } as any;

    const parsed = parseSegmentFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.employee_count', operator: 'gte', value: 100 },
      { field: 'companies.employee_count', operator: 'lte', value: 500 },
      { field: 'companies.segment', operator: 'in', value: ['Fintech', 'AI'] },
      { field: 'companies.segment', operator: 'not_in', value: ['Legacy'] },
      { field: 'employees.position', operator: 'contains', value: 'директор' },
    ]);

    buildContactQuery(client, parsed);

    expect(calls).toEqual([
      { method: 'eq', args: ['position', 'CTO'] },
      { method: 'gte', args: ['company.employee_count', 100] },
      { method: 'lte', args: ['company.employee_count', 500] },
      { method: 'in', args: ['company.segment', ['Fintech', 'AI']] },
      { method: 'not', args: ['company.segment', 'in', ['Legacy']] },
      { method: 'ilike', args: ['position', '%директор%'] },
    ]);
  });

  it('validateFilters returns structured errors', () => {
    const ok = validateFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
    ]);
    expect(ok.ok).toBe(true);
    expect(ok.filters).toHaveLength(1);

    const bad = validateFilters([{ field: 'unknown.field', operator: 'eq', value: 'x' }]);
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe('ERR_FILTER_VALIDATION');
    expect(bad.error?.message).toMatch(/Unknown field/);
    expect(bad.error?.details?.allowedFields).toBeDefined();
    expect((bad.error?.details?.allowedFields as string[])).toContain('employees.role');
    expect(bad.error?.details?.allowedOperators).toContain('eq');
  });

  it('rejects unsupported but prefix-valid employees field', () => {
    const result = validateFilters([{ field: 'employees.headcount', operator: 'gte', value: 50 }]);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ERR_FILTER_VALIDATION');
    expect(result.error?.message).toMatch(/Unknown field/);
  });

  it('rejects unsupported but prefix-valid companies field', () => {
    const result = validateFilters([{ field: 'companies.unknown_metric', operator: 'gte', value: 10 }]);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ERR_FILTER_VALIDATION');
    expect(result.error?.message).toMatch(/Unknown field/);
  });
});
