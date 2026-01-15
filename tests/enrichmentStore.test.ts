import { describe, expect, it } from 'vitest';

import { getProviderResult, isEnrichmentStoreV1, upsertProviderResult } from '../src/services/enrichment/store';

describe('enrichment store', () => {
  it('creates a v1 store when existing is null', () => {
    const store = upsertProviderResult({
      existing: null,
      provider: 'exa',
      result: { summary: 'hello' },
      now: new Date('2025-12-26T00:00:00.000Z'),
    });
    expect(isEnrichmentStoreV1(store)).toBe(true);
    expect(store.providers.exa).toEqual({ summary: 'hello' });
    expect(store.lastUpdatedAt).toBe('2025-12-26T00:00:00.000Z');
  });

  it('merges provider results without overwriting other providers', () => {
    const existing = upsertProviderResult({
      existing: null,
      provider: 'exa',
      result: { summary: 'exa' },
      now: new Date('2025-12-26T00:00:00.000Z'),
    });
    const merged = upsertProviderResult({
      existing,
      provider: 'firecrawl',
      result: { summary: 'firecrawl' },
      now: new Date('2025-12-26T01:00:00.000Z'),
    });

    expect((merged.providers as any).exa).toEqual({ summary: 'exa' });
    expect((merged.providers as any).firecrawl).toEqual({ summary: 'firecrawl' });
    expect(merged.lastUpdatedAt).toBe('2025-12-26T01:00:00.000Z');
  });

  it('getProviderResult returns null for non-store values', () => {
    expect(getProviderResult({ provider: 'exa' }, 'exa')).toBeNull();
  });

  it('getProviderResult returns provider result when present', () => {
    const store = upsertProviderResult({
      existing: null,
      provider: 'exa',
      result: { summary: 'exa' },
      now: new Date('2025-12-26T00:00:00.000Z'),
    });
    expect(getProviderResult(store, 'exa')).toEqual({ summary: 'exa' });
    expect(getProviderResult(store, 'firecrawl')).toBeNull();
  });
});

