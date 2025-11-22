import { describe, expect, it } from 'vitest';

import { parseSegmentFilters } from '../src/services/segments';

describe('parseSegmentFilters', () => {
  it('normalizes eq and ilike operators', () => {
    const filters = parseSegmentFilters([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.segment', operator: 'ilike', value: '%Fintech%' },
    ]);

    expect(filters).toEqual([
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.segment', operator: 'ilike', value: '%Fintech%' },
    ]);
  });

  it('throws on unsupported operator', () => {
    expect(() =>
      parseSegmentFilters([
        { field: 'employees.role', operator: 'gt', value: 10 },
      ])
    ).toThrow(/Unsupported operator/);
  });
});
