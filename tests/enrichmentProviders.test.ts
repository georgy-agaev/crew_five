import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildParallelClientFromEnv } from '../src/integrations/parallel';
import { buildFirecrawlClientFromEnv } from '../src/integrations/firecrawl';
import { buildAnySiteClientFromEnv } from '../src/integrations/anysite';

describe('enrichment provider clients', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parallel_client_requires_api_key_env', () => {
    delete process.env.PARALLEL_API_KEY;
    expect(() => buildParallelClientFromEnv()).toThrow(/PARALLEL_API_KEY/);
  });

  it('parallel_client_researchCompany_returns_stubbed_summary_and_sources', async () => {
    process.env.PARALLEL_API_KEY = 'test-parallel-key';
    process.env.PARALLEL_API_BASE = 'https://parallel.example';

    const client = buildParallelClientFromEnv(() => ({
      apiKey: 'test-parallel-key',
      baseUrl: 'https://parallel.example',
    }));

    const result: any = await client.researchCompany({
      companyName: 'Acme Corp',
      website: 'https://acme.example',
      country: 'US',
    });

    expect(result.summary).toContain('Acme Corp');
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources[0]?.url).toBe('https://acme.example');
    expect(result.provider).toBe('parallel');
  });

  it('firecrawl_client_requires_api_key_env', () => {
    delete process.env.FIRECRAWL_API_KEY;
    expect(() => buildFirecrawlClientFromEnv()).toThrow(/FIRECRAWL_API_KEY/);
  });

  it('anysite_client_requires_api_key_env', () => {
    delete process.env.ANYSITE_API_KEY;
    expect(() => buildAnySiteClientFromEnv()).toThrow(/ANYSITE_API_KEY/);
  });
});
