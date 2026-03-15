import { describe, expect, it, vi } from 'vitest';

import { listSegmentsWithCounts } from '../src/services/segments';
import * as filterPreview from '../src/services/filterPreview';

describe('listSegmentsWithCounts', () => {
  it('attaches company_count and employee_count from filter preview when possible', async () => {
    const segments = [
      {
        id: 'seg-1',
        name: 'Segment 1',
        version: 1,
        created_at: '2025-12-26T00:00:00.000Z',
        filter_definition: [{ field: 'employees.position', operator: 'eq', value: 'CTO' }],
      },
      {
        id: 'seg-2',
        name: 'Non-DSL Segment',
        version: 1,
        created_at: '2025-12-26T00:00:00.000Z',
        filter_definition: null,
      },
    ];

    const select = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: segments, error: null }),
    });

    const client = {
      from: (table: string) => {
        if (table === 'segments') return { select };
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const previewSpy = vi
      .spyOn(filterPreview, 'getFilterPreviewCounts')
      .mockResolvedValue({ companyCount: 7, employeeCount: 11, totalCount: 11 });

    const result = await listSegmentsWithCounts(client);
    expect(previewSpy).toHaveBeenCalledTimes(1);
    expect(previewSpy).toHaveBeenCalledWith(client, segments[0].filter_definition);

    const first = result.find((row: any) => row.id === 'seg-1');
    expect(first.company_count).toBe(7);
    expect(first.employee_count).toBe(11);

    const second = result.find((row: any) => row.id === 'seg-2');
    expect(second.company_count).toBe(0);
    expect(second.employee_count).toBe(0);
  });

  it('filters segments by linked ICP identifiers before computing counts', async () => {
    const segments = [
      {
        id: 'seg-1',
        name: 'Segment 1',
        version: 1,
        created_at: '2025-12-26T00:00:00.000Z',
        filter_definition: [{ field: 'employees.position', operator: 'eq', value: 'CTO' }],
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hyp-1',
      },
      {
        id: 'seg-2',
        name: 'Segment 2',
        version: 1,
        created_at: '2025-12-26T00:00:00.000Z',
        filter_definition: [{ field: 'employees.position', operator: 'eq', value: 'CEO' }],
        icp_profile_id: 'icp-2',
        icp_hypothesis_id: 'hyp-2',
      },
    ];

    const select = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: segments, error: null }),
    });

    const client = {
      from: (table: string) => {
        if (table === 'segments') return { select };
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    vi.spyOn(filterPreview, 'getFilterPreviewCounts').mockResolvedValue({
      companyCount: 1,
      employeeCount: 2,
      totalCount: 2,
    });

    const result = await listSegmentsWithCounts(client, { icpProfileId: 'icp-1', icpHypothesisId: 'hyp-1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('seg-1');
  });
});
