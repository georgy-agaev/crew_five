import { describe, expect, it } from 'vitest';

import { parseSegmentFilters, validateFilters } from './index.js';

describe('segment filter compatibility', () => {
  it('parses canonical filter clauses', () => {
    expect(
      parseSegmentFilters([
        { field: 'companies.employee_count', operator: 'gte', value: 30 },
        { field: 'employees.position', operator: 'eq', value: 'CTO' },
      ])
    ).toEqual([
      { field: 'companies.employee_count', op: 'gte', value: 30 },
      { field: 'employees.position', op: 'eq', value: 'CTO' },
    ]);
  });

  it('accepts legacy op key and normalizes legacy field aliases', () => {
    expect(
      parseSegmentFilters([
        { field: 'employee_count', op: 'gte', value: 30 },
        { field: 'office_qualification', op: 'eq', value: 'Less' },
        { field: 'processing_status', op: 'eq', value: 'completed' },
        { field: 'employees.work_email_status', op: 'eq', value: 'bounced' },
        { field: 'id', op: 'in', value: ['ct-1', 'ct-2'] },
      ])
    ).toEqual([
      { field: 'companies.employee_count', op: 'gte', value: 30 },
      { field: 'companies.office_qualification', op: 'eq', value: 'Less' },
      { field: 'employees.processing_status', op: 'eq', value: 'completed' },
      { field: 'employees.work_email_status', op: 'eq', value: 'bounced' },
      { field: 'employees.id', op: 'in', value: ['ct-1', 'ct-2'] },
    ]);
  });

  it('validateFilters reports ok for legacy filter format', () => {
    expect(
      validateFilters([
        { field: 'employee_count', op: 'gte', value: 30 },
        { field: 'office_qualification', op: 'eq', value: 'Less' },
        { field: 'id', op: 'in', value: ['ct-1'] },
      ])
    ).toEqual({
      ok: true,
      filters: [
        { field: 'companies.employee_count', op: 'gte', value: 30 },
        { field: 'companies.office_qualification', op: 'eq', value: 'Less' },
        { field: 'employees.id', op: 'in', value: ['ct-1'] },
      ],
    });
  });
});
