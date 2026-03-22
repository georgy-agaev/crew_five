import { describe, expect, it, vi } from 'vitest';

import { buildMeta, createWebAdapter } from '../src/web/server.js';

async function invokeServer(method: string, url: string) {
  const server = createWebAdapter(
    {
      listCampaigns: vi.fn(async () => []),
      listDrafts: vi.fn(async () => []),
      generateDrafts: vi.fn(async () => ({ generated: 0, dryRun: true })),
      sendSmartlead: vi.fn(async () => ({
        dryRun: true,
        campaignId: 'camp',
        smartleadCampaignId: 'sl',
        leadsPrepared: 0,
        leadsPushed: 0,
        sequencesPrepared: 0,
        sequencesSynced: 0,
        skippedContactsNoEmail: 0,
      })),
      listEvents: vi.fn(async () => []),
      listReplyPatterns: vi.fn(async () => []),
    } as any,
    buildMeta({ mode: 'live' })
  );

  const writeHead = vi.fn();
  const end = vi.fn();

  server.emit(
    'request',
    {
      method,
      url,
    },
    {
      writeHead,
      end,
    }
  );

  await new Promise((resolve) => setImmediate(resolve));

  return { writeHead, end };
}

describe('web adapter CORS', () => {
  it('adds CORS headers to JSON responses', async () => {
    const { writeHead } = await invokeServer('GET', '/api/meta');

    expect(writeHead).toHaveBeenCalledTimes(1);
    expect(writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      })
    );
  });

  it('handles CORS preflight requests', async () => {
    const { writeHead, end } = await invokeServer('OPTIONS', '/api/meta');

    expect(writeHead).toHaveBeenCalledTimes(1);
    expect(writeHead).toHaveBeenCalledWith(
      204,
      expect.objectContaining({
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
      })
    );
    expect(end).toHaveBeenCalledTimes(1);
  });
});
