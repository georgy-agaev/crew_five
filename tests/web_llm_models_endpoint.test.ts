import { describe, expect, it, vi } from 'vitest';

import { dispatch } from '../src/web/server';

describe('LLM models web endpoint', () => {
  const baseDeps = {
    listCampaigns: vi.fn(async () => []),
    listDrafts: vi.fn(async () => []),
    generateDrafts: vi.fn(async () => ({ generated: 0, dryRun: true })),
    sendSmartlead: vi.fn(async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 })),
    listEvents: vi.fn(async () => []),
    listReplyPatterns: vi.fn(async () => []),
  };

  it('returns models for a supported provider', async () => {
    const listLlmModels = vi.fn(async () => [
      { id: 'gpt-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', provider: 'openai' },
    ]);

    const res = await dispatch(
      { ...baseDeps, listLlmModels } as any,
      {
        method: 'GET',
        pathname: '/api/llm/models',
        searchParams: new URLSearchParams({ provider: 'openai' }),
      }
    );

    expect(listLlmModels).toHaveBeenCalledWith('openai');
    expect(res.status).toBe(200);
    const body = res.body as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('gpt-4o');
  });

  it('rejects unknown providers with 400', async () => {
    const res = await dispatch(
      { ...baseDeps } as any,
      {
        method: 'GET',
        pathname: '/api/llm/models',
        searchParams: new URLSearchParams({ provider: 'unknown' }),
      }
    );

    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/unsupported provider/i);
  });

  it('returns 501 when listLlmModels is not configured', async () => {
    const res = await dispatch(
      { ...baseDeps } as any,
      {
        method: 'GET',
        pathname: '/api/llm/models',
        searchParams: new URLSearchParams({ provider: 'openai' }),
      }
    );

    expect(res.status).toBe(501);
    expect((res.body as any).error).toMatch(/llm models endpoint not configured/i);
  });
});

