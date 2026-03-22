import { describe, expect, it, vi } from 'vitest';

import { createOffer, getOffer, listOffers, updateOffer } from '../src/services/offers';

describe('offers service', () => {
  it('creates an active offer by default', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'offer-1',
        project_id: 'project-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Audit offer',
        status: 'active',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as any;

    const result = await createOffer(client, {
      projectId: 'project-1',
      title: 'Negotiation room audit',
      projectName: 'VoiceXpert',
      description: 'Audit offer',
    });

    expect(client.from).toHaveBeenCalledWith('offers');
    expect(insert).toHaveBeenCalledWith([
      {
        project_id: 'project-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Audit offer',
        status: 'active',
      },
    ]);
    expect(result.status).toBe('active');
  });

  it('lists offers newest first and can filter by status', async () => {
    const statusEq = vi.fn().mockResolvedValue({
      data: [{ id: 'offer-1', title: 'Negotiation room audit', status: 'active' }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ eq: statusEq });
    const select = vi.fn().mockReturnValue({ order });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const rows = await listOffers(client, { status: 'active' });

    expect(select).toHaveBeenCalledWith('id,project_id,title,project_name,description,status,created_at,updated_at');
    expect(statusEq).toHaveBeenCalledWith('status', 'active');
    expect(rows[0].id).toBe('offer-1');
  });

  it('loads and updates an existing offer', async () => {
    const singleGet = vi.fn().mockResolvedValue({
      data: {
        id: 'offer-1',
        project_id: 'project-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Audit offer',
        status: 'active',
      },
      error: null,
    });
    const eqGet = vi.fn().mockReturnValue({ single: singleGet });
    const selectGet = vi.fn().mockReturnValue({ eq: eqGet });

    const singleUpdate = vi.fn().mockResolvedValue({
      data: {
        id: 'offer-1',
        project_id: 'project-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Updated audit offer',
        status: 'inactive',
      },
      error: null,
    });
    const selectUpdate = vi.fn().mockReturnValue({ single: singleUpdate });
    const eqUpdate = vi.fn().mockReturnValue({ select: selectUpdate });
    const update = vi.fn().mockReturnValue({ eq: eqUpdate });

    const client = {
      from: vi.fn((table: string) => {
        if (table !== 'offers') throw new Error(`unexpected table ${table}`);
        return {
          select: selectGet,
          update,
        };
      }),
    } as any;

    const existing = await getOffer(client, 'offer-1');
    const updated = await updateOffer(client, 'offer-1', {
      description: 'Updated audit offer',
      status: 'inactive',
    });

    expect(existing.id).toBe('offer-1');
    expect(update).toHaveBeenCalledWith({
      description: 'Updated audit offer',
      status: 'inactive',
    });
    expect(updated.status).toBe('inactive');
  });
});
