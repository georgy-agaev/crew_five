import { describe, expect, it, vi } from 'vitest';

import { listCampaigns } from '../src/services/campaigns';

describe('listCampaigns', () => {
  it('applies status and segment filters', async () => {
    const segmentEq = vi.fn().mockResolvedValue({
      data: [{ id: 'camp-1', status: 'review', segment_id: 'seg-1' }],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ eq: segmentEq });
    const order = vi.fn().mockReturnValue({ eq: statusEq });
    const select = vi.fn().mockReturnValue({ order });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const rows = await listCampaigns(client, { status: 'review', segmentId: 'seg-1' });

    expect(select).toHaveBeenCalledWith(
      'id,name,status,segment_id,segment_version,offer_id,created_by,metadata,created_at,updated_at'
    );
    expect(statusEq).toHaveBeenCalledWith('status', 'review');
    expect(segmentEq).toHaveBeenCalledWith('segment_id', 'seg-1');
    expect(rows[0].id).toBe('camp-1');
  });

  it('filters campaigns by icp profile via matching segments', async () => {
    const campaignsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'camp-2', status: 'draft', segment_id: 'seg-2' }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ in: campaignsIn });
    const campaignsSelect = vi.fn().mockReturnValue({ order });

    const segmentsEq = vi.fn().mockResolvedValue({
      data: [{ id: 'seg-2' }, { id: 'seg-3' }],
      error: null,
    });
    const segmentsSelect = vi.fn().mockReturnValue({ eq: segmentsEq });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'segments') {
          return { select: segmentsSelect };
        }
        return { select: campaignsSelect };
      }),
    } as any;

    const rows = await listCampaigns(client, { icpProfileId: 'icp-1' });

    expect(segmentsEq).toHaveBeenCalledWith('icp_profile_id', 'icp-1');
    expect(campaignsIn).toHaveBeenCalledWith('segment_id', ['seg-2', 'seg-3']);
    expect(rows).toEqual([{ id: 'camp-2', status: 'draft', segment_id: 'seg-2' }]);
  });

  it('returns an empty list when no segments match the requested icp profile', async () => {
    const segmentsEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const segmentsSelect = vi.fn().mockReturnValue({ eq: segmentsEq });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'segments') {
          return { select: segmentsSelect };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const rows = await listCampaigns(client, { icpProfileId: 'icp-missing' });

    expect(rows).toEqual([]);
  });
});
