import { describe, expect, it, vi } from 'vitest';

import { fetchContactsForSegment } from '../src/services/segments';

describe('fetchContactsForSegment', () => {
  it('builds Supabase query for eq, gte, lte, and in filters', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    chain.select.mockReturnValue({ data: [], error: null, ...chain });

    const from = vi.fn().mockReturnValue(chain);
    const client = { from } as any;

    await fetchContactsForSegment(client, [
      { field: 'employees.role', op: 'eq', value: 'CTO' },
      { field: 'companies.employee_count', op: 'gte', value: 50 },
      { field: 'companies.employee_count', op: 'lte', value: 500 },
      { field: 'companies.segment', op: 'in', value: ['Fintech', 'AI'] },
    ]);

    expect(from).toHaveBeenCalledWith('employees');
    expect(chain.select).toHaveBeenCalled();
    expect(String(chain.select.mock.calls[0]?.[0] ?? '')).toContain('company_description');
    expect(String(chain.select.mock.calls[0]?.[0] ?? '')).toContain('website');
    expect(String(chain.select.mock.calls[0]?.[0] ?? '')).toContain('employee_count');
    expect(String(chain.select.mock.calls[0]?.[0] ?? '')).toContain('company_research');
    expect(chain.eq).toHaveBeenCalledWith('position', 'CTO');
    expect(chain.gte).toHaveBeenCalledWith('company.employee_count', 50);
    expect(chain.lte).toHaveBeenCalledWith('company.employee_count', 500);
    expect(chain.in).toHaveBeenCalledWith('company.segment', ['Fintech', 'AI']);
  });

  it('throws when Supabase returns an error', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    chain.select.mockReturnValue({ data: null, error: new Error('boom'), ...chain });
    const client = { from: vi.fn().mockReturnValue(chain) } as any;

    await expect(
      fetchContactsForSegment(client, [
        { field: 'employees.role', op: 'eq', value: 'CTO' },
      ])
    ).rejects.toThrow('boom');
  });
});
