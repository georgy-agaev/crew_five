import { describe, expect, it } from 'vitest';

import { buildMeta, createWebAdapter } from '../src/web/server';

describe('web adapter inbox endpoints', () => {
  it('GET /api/inbox/messages returns empty inbox shape', async () => {
    const meta = buildMeta({ mode: 'live' });
    const server = createWebAdapter(
      {
        listCampaigns: async () => [],
        listDrafts: async () => [],
        generateDrafts: async () => ({ generated: 0, dryRun: true }),
        sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
        listEvents: async () => [],
        listReplyPatterns: async () => [],
      } as any,
      meta
    );

    await new Promise<void>((resolve, reject) => {
      server.listen(0, resolve);
      server.on('error', reject);
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const res = await fetch(`http://localhost:${port}/api/inbox/messages`);
    const body = (await res.json()) as { messages: unknown[]; total: number };

    server.close();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.total).toBeTypeOf('number');
  });
});

