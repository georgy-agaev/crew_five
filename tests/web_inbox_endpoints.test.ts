import { describe, expect, it } from 'vitest';

import { buildMeta, dispatch } from '../src/web/server';

describe('web adapter inbox endpoints', () => {
  it('GET /api/inbox/messages returns empty inbox shape', async () => {
    const meta = buildMeta({ mode: 'live' });
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
    } as any;

    const response = await dispatch(
      {
        ...deps,
      },
      { method: 'GET', pathname: '/api/inbox/messages' },
      meta
    );
    const body = response.body as { messages: unknown[]; total: number };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.total).toBeTypeOf('number');
  });
});
