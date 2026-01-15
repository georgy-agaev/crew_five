import { describe, expect, it } from 'vitest';

import {
  filterDraftsByStatus,
  getEnrichmentPrimaryProvider,
  getEnrichmentProviders,
  type DraftRow,
} from './DraftsPage';

const sampleDrafts: DraftRow[] = [
  { id: 'd1', status: 'approved' },
  { id: 'd2', status: 'pending' },
  { id: 'd3', status: 'rejected' },
];

describe('DraftsPage helpers', () => {
  it('returns all drafts when status is empty', () => {
    expect(filterDraftsByStatus(sampleDrafts, '')).toEqual(sampleDrafts);
  });

  it('filters drafts by status', () => {
    const approved = filterDraftsByStatus(sampleDrafts, 'approved');
    expect(approved).toHaveLength(1);
    expect(approved[0].id).toBe('d1');
  });

  it('extracts enrichment primary provider from draft metadata', () => {
    expect(getEnrichmentPrimaryProvider({})).toBe(null);
    expect(getEnrichmentPrimaryProvider({ enrichment_provider: 'exa' })).toBe('exa');
    expect(getEnrichmentPrimaryProvider({ enrichment_provider: '' })).toBe(null);
    expect(getEnrichmentPrimaryProvider({ enrichment_provider: { company: 'firecrawl', employee: 'exa' } })).toBe(
      'firecrawl/exa'
    );
    expect(getEnrichmentPrimaryProvider({ enrichment_provider: { company: 'exa', employee: 'exa' } })).toBe('exa');
  });

  it('extracts enrichment providers list from draft metadata', () => {
    expect(getEnrichmentProviders({})).toEqual([]);
    expect(getEnrichmentProviders({ enrichment_provider: 'exa' })).toEqual(['exa']);
    expect(getEnrichmentProviders({ enrichment_provider: { company: 'firecrawl', employee: 'exa' } })).toEqual([
      'exa',
      'firecrawl',
    ]);
    expect(getEnrichmentProviders({ enrichment_by_provider: { exa: { mode: 'primary' }, firecrawl: {} } })).toEqual([
      'exa',
      'firecrawl',
    ]);
  });
});
