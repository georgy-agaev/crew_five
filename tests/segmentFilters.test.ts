import { describe, expect, it } from 'vitest';

import { buildContactQuery, parseSegmentFilters } from '../src/filters';

describe('parseSegmentFilters', () => {
  it('parses minimal operators and rejects unknown', () => {
    const filters = parseSegmentFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.segment', operator: 'in', value: ['Fintech', 'AI'] },
      { field: 'employees.headcount', operator: 'gte', value: 50 },
    ]);

    expect(filters).toEqual([
      { field: 'employees.role', op: 'eq', value: 'CTO' },
      { field: 'companies.segment', op: 'in', value: ['Fintech', 'AI'] },
      { field: 'employees.headcount', op: 'gte', value: 50 },
    ]);

    expect(() => parseSegmentFilters([])).toThrow(/at least one filter/);
    expect(() =>
      parseSegmentFilters([{ field: 'unknown.field', operator: 'eq', value: 'x' }])
    ).toThrow(/Unknown field/);
    expect(() =>
      parseSegmentFilters([{ field: 'employees.role', operator: 'gt', value: 1 }])
    ).toThrow(/Unsupported operator/);
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
    };
    const client = {
      from: () => ({
        select: () => query,
      }),
    } as any;

    const parsed = parseSegmentFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'employees.headcount', operator: 'gte', value: 100 },
      { field: 'employees.headcount', operator: 'lte', value: 500 },
      { field: 'companies.segment', operator: 'in', value: ['Fintech', 'AI'] },
      { field: 'companies.segment', operator: 'not_in', value: ['Legacy'] },
    ]);

    buildContactQuery(client, parsed);

    expect(calls).toEqual([
      { method: 'eq', args: ['employees.role', 'CTO'] },
      { method: 'gte', args: ['employees.headcount', 100] },
      { method: 'lte', args: ['employees.headcount', 500] },
      { method: 'in', args: ['companies.segment', ['Fintech', 'AI']] },
      { method: 'not', args: ['companies.segment', 'in', ['Legacy']] },
    ]);
  });
});
