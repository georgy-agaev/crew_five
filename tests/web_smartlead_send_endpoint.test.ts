import { describe, expect, it, vi } from 'vitest';

import { buildMeta, dispatch } from '../src/web/server';

describe('web smartlead send endpoint', () => {
  it('returns 400 when missing required ids', async () => {
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
      } as any,
      { method: 'POST', pathname: '/api/smartlead/send', body: { dryRun: true } },
      buildMeta({ mode: 'live' })
    );
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/campaignId is required/i);
  });

  it('defaults to dry-run and forwards ids', async () => {
    const sendSmartlead = vi.fn(async (payload) => ({ ok: true, payload }));
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead,
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
      } as any,
      {
        method: 'POST',
        pathname: '/api/smartlead/send',
        body: { campaignId: 'camp-1', smartleadCampaignId: 'sl-1', batchSize: 20 },
      },
      buildMeta({ mode: 'live' })
    );
    expect(res.status).toBe(200);
    expect(sendSmartlead).toHaveBeenCalledWith({
      dryRun: true,
      batchSize: 20,
      campaignId: 'camp-1',
      smartleadCampaignId: 'sl-1',
    });
  });
});

