import { describe, expect, it, vi } from 'vitest';

import { createSegmentSnapshot } from '../src/services/segmentSnapshot';

describe('createSegmentSnapshot', () => {
  it('replaces existing membership rows with new snapshot payloads', async () => {
    const match = vi.fn().mockResolvedValue({ error: null });
    const deleteBuilder = { match };
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'member-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'segment_members') {
        return {
          delete: () => deleteBuilder,
          insert,
        } as any;
      }
      throw new Error('unexpected table');
    });

    const client = { from } as any;

    const result = await createSegmentSnapshot(
      client,
      { id: 'segment-1', version: 2 },
      [
        {
          id: 'contact-1',
          company_id: 'company-1',
          full_name: 'Jane Doe',
          work_email: 'jane@example.com',
        },
      ]
    );

    expect(match).toHaveBeenCalledWith({ segment_id: 'segment-1', segment_version: 2 });
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(result.inserted).toBe(1);
  });

  it('persists company_research inside company snapshot payload', async () => {
    const match = vi.fn().mockResolvedValue({ error: null });
    const deleteBuilder = { match };
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'member-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'segment_members') {
        return {
          delete: () => deleteBuilder,
          insert,
        } as any;
      }
      throw new Error('unexpected table');
    });

    const client = { from } as any;

    await createSegmentSnapshot(
      client,
      { id: 'segment-1', version: 2 },
      [
        {
          id: 'contact-1',
          company_id: 'company-1',
          company: {
            id: 'company-1',
            company_name: 'Acme',
            company_description: 'Industrial automation',
            website: 'acme.example',
            employee_count: 120,
            region: 'FR',
            office_qualification: 'Less',
            company_research: { provider: 'exa', summary: 'Deep research' },
          },
        },
      ]
    );

    const rows = insert.mock.calls[0]?.[0] as any[];
    expect(rows[0].snapshot.company.company_description).toBe('Industrial automation');
    expect(rows[0].snapshot.company.website).toBe('acme.example');
    expect(rows[0].snapshot.company.employee_count).toBe(120);
    expect(rows[0].snapshot.company.region).toBe('FR');
    expect(rows[0].snapshot.company.office_qualification).toBe('Less');
    expect(rows[0].snapshot.company.company_research).toEqual({
      provider: 'exa',
      summary: 'Deep research',
    });
  });
});
