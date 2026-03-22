import { describe, expect, it, vi } from 'vitest';

import { buildMeta, dispatch } from '../src/web/server';

describe('web campaigns create endpoint', () => {
  it('returns 400 when missing required fields', async () => {
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        createCampaign: vi.fn(),
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns',
        body: { name: 'Test' },
      },
      buildMeta({ mode: 'live' })
    );

    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/segmentId is required/i);
  });

  it('creates campaign and returns 201', async () => {
    const createCampaign = vi.fn(async (payload) => ({ id: 'camp-1', ...payload }));
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        createCampaign,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns',
        body: { name: 'Test', segmentId: 'seg-1', segmentVersion: 1 },
      },
      buildMeta({ mode: 'live' })
    );

    expect(res.status).toBe(201);
    expect(createCampaign).toHaveBeenCalledWith({
      name: 'Test',
      segmentId: 'seg-1',
      segmentVersion: 1,
    });
    expect((res.body as any).id).toBe('camp-1');
  });
});

