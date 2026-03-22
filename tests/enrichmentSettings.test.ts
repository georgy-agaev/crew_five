import { describe, expect, it, vi } from 'vitest';

import { setEnrichmentSettings } from '../src/services/enrichmentSettings';

describe('enrichment settings', () => {
  it('set_enrichment_settings_rejects_unverified_providers', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table !== 'app_settings') throw new Error(`Unexpected table ${table}`);
      return { upsert };
    });
    const supabase = { from } as any;

    const ready = new Set<any>(['mock', 'exa', 'firecrawl']);
    const probe = vi.fn(async (providerId: string) => {
      if (providerId === 'firecrawl') return { ok: false, reason: 'invalid key' };
      return { ok: true };
    });

    await expect(
      setEnrichmentSettings(
        supabase,
        {
          defaultProviders: ['exa', 'firecrawl'],
          primaryCompanyProvider: 'firecrawl',
          primaryEmployeeProvider: 'exa',
        },
        ready,
        probe as any
      )
    ).rejects.toThrow(/firecrawl/i);

    expect(probe).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

