import { describe, expect, it } from 'vitest';

import { buildHybridEnrichmentByProvider } from '../src/services/enrichment/hybridContext';

describe('buildHybridEnrichmentByProvider', () => {
  it('returns null when there is no provider data', () => {
    const result = buildHybridEnrichmentByProvider({
      primaryProvider: 'exa',
      companyStore: null,
      employeeStore: null,
    });
    expect(result).toBeNull();
  });

  it('includes full payload for primary provider and summaries for others', () => {
    const companyStore = {
      version: 1,
      lastUpdatedAt: new Date().toISOString(),
      providers: {
        exa: { company: 'Acme', score: 1 },
        firecrawl: { summary: 'Firecrawl summary', html: '<html>...</html>' },
      },
    };
    const employeeStore = {
      version: 1,
      lastUpdatedAt: new Date().toISOString(),
      providers: {
        exa: { full_name: 'Jane Doe', linkedin_url: 'https://example.com' },
        firecrawl: { summary: 'Lead summary', blobs: Array.from({ length: 50 }, (_, i) => `x${i}`) },
      },
    };

    const result = buildHybridEnrichmentByProvider({
      primaryProvider: 'exa',
      companyStore,
      employeeStore,
      maxPrimaryChars: 25000,
      maxSupplementalChars: 2000,
    });

    expect(result).not.toBeNull();
    expect(result?.exa.mode).toBe('full');
    expect((result?.exa as any).company).toEqual({ company: 'Acme', score: 1 });
    expect((result?.exa as any).lead).toEqual({ full_name: 'Jane Doe', linkedin_url: 'https://example.com' });

    expect(result?.firecrawl.mode).toBe('summary');
    expect((result?.firecrawl as any).company_summary).toEqual(
      expect.objectContaining({ type: 'object', truncated: expect.any(Boolean) })
    );
    expect((result?.firecrawl as any).lead_summary).toEqual(
      expect.objectContaining({ type: 'object', truncated: expect.any(Boolean) })
    );
    expect((result?.firecrawl as any).company).toBeUndefined();
    expect((result?.firecrawl as any).lead).toBeUndefined();
  });

  it('falls back to summary when primary payload exceeds maxPrimaryChars', () => {
    const huge = 'x'.repeat(500);
    const companyStore = {
      version: 1,
      lastUpdatedAt: new Date().toISOString(),
      providers: {
        exa: { huge },
      },
    };

    const result = buildHybridEnrichmentByProvider({
      primaryProvider: 'exa',
      companyStore,
      employeeStore: null,
      maxPrimaryChars: 50,
      maxSupplementalChars: 200,
    });

    expect(result?.exa.mode).toBe('summary');
    expect((result?.exa as any).company_summary).toEqual(
      expect.objectContaining({ truncated: true })
    );
  });
});

