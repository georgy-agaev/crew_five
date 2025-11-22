import { describe, expect, it, vi } from 'vitest';

import { fetchContactsForSegment } from '../src/services/segments';

const mockQuery = () => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
  };
  return chain;
};

describe('fetchContactsForSegment', () => {
  it('builds Supabase query for eq and ilike filters', async () => {
    const chain = mockQuery();
    chain.select.mockReturnValue({ data: [], error: null, eq: chain.eq, ilike: chain.ilike });

    const from = vi.fn().mockReturnValue(chain);
    const client = { from } as any;

    await fetchContactsForSegment(client, [
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
      { field: 'companies.segment', operator: 'ilike', value: '%Fintech%' },
    ]);

    expect(from).toHaveBeenCalledWith('employees');
    expect(chain.select).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('employees.role', 'CTO');
    expect(chain.ilike).toHaveBeenCalledWith('companies.segment', '%Fintech%');
  });

  it('throws when Supabase returns an error', async () => {
    const chain = mockQuery();
    chain.select.mockReturnValue({ data: null, error: new Error('boom'), eq: chain.eq, ilike: chain.ilike });
    const client = { from: vi.fn().mockReturnValue(chain) } as any;

    await expect(
      fetchContactsForSegment(client, [
        { field: 'employees.role', operator: 'eq', value: 'CTO' },
      ])
    ).rejects.toThrow('boom');
  });
});
