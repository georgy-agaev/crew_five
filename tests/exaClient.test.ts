import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { buildExaClientFromEnv, buildExaResearchClientFromEnv } from '../src/integrations/exa';

describe('Exa client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exa_client_requires_api_key_env', async () => {
    delete process.env.EXA_API_KEY;
    await expect(async () => {
      buildExaClientFromEnv();
    }).rejects.toThrow(/EXA_API_KEY/);
  });

  it('exa_client_uses_base_url_and_auth_header', async () => {
    process.env.EXA_API_KEY = 'test-key';
    process.env.EXA_API_BASE = 'https://api.exa.example';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'ws-1', items: [] }) } as any);

    const client = buildExaClientFromEnv();
    await client.createWebset({ name: 'Test', queries: ['query one'] });

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain('https://api.exa.example');
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
  });

  it('exa_research_client_requires_api_key_env', async () => {
    delete process.env.EXA_API_KEY;
    await expect(async () => {
      buildExaResearchClientFromEnv();
    }).rejects.toThrow(/EXA_API_KEY/);
  });

  it('exa_research_client_calls_answer_with_expected_payload', async () => {
    process.env.EXA_API_KEY = 'test-key';
    process.env.EXA_API_BASE = 'https://api.exa.example';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: async () => ({ answer: 'Summary', sources: [] }) } as any);

    const client = buildExaResearchClientFromEnv();
    await client.researchCompany({
      companyName: 'Acme Corp',
      website: 'https://acme.example',
      country: 'US',
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/answer');
    expect(url).toContain('https://api.exa.example');
    const body = JSON.parse((init.body as string) ?? '{}');
    expect(body).toMatchObject({
      query: expect.stringContaining('Acme Corp'),
    });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
  });
});
