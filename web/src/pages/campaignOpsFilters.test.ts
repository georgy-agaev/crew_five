import { describe, expect, it } from 'vitest';

import { filterAndSortCampaignCompanies, filterAndSortCampaigns } from './campaignOpsFilters';

describe('campaignOpsFilters', () => {
  it('filters and sorts campaigns by search, status, and sort mode', () => {
    const rows = filterAndSortCampaigns(
      [
        { id: 'c2', name: 'Beta Push', status: 'review', segment_id: 'seg-2' },
        { id: 'c1', name: 'Alpha Push', status: 'draft', segment_id: 'seg-1' },
        { id: 'c3', name: 'Gamma Push', status: 'draft', segment_id: 'seg-3' },
      ],
      'push',
      'draft',
      'name'
    );

    expect(rows.map((row) => row.id)).toEqual(['c1', 'c3']);

    const byStatus = filterAndSortCampaigns(
      [
        { id: 'c2', name: 'Beta Push', status: 'review', segment_id: 'seg-2' },
        { id: 'c1', name: 'Alpha Push', status: 'draft', segment_id: 'seg-1' },
      ],
      '',
      'all',
      'status'
    );

    expect(byStatus.map((row) => row.id)).toEqual(['c1', 'c2']);
  });

  it('filters and sorts campaign companies by research state, search, and sort mode', () => {
    const rows = filterAndSortCampaignCompanies(
      {
        campaign: { id: 'camp-1', name: 'Q1 Push', segment_id: 'seg-1', segment_version: 2 },
        companies: [
          {
            company_id: 'comp-2',
            company_name: 'Bravo',
            region: 'Paris',
            contact_count: 1,
            company_research: null,
            enrichment: {
              status: 'missing',
              last_updated_at: null,
              provider_hint: null,
            },
          },
          {
            company_id: 'comp-1',
            company_name: 'Alpha',
            region: 'Moscow',
            contact_count: 4,
            company_research: { facts: ['x'] },
            enrichment: {
              status: 'fresh',
              last_updated_at: '2026-03-16T10:00:00Z',
              provider_hint: 'exa',
            },
          },
          {
            company_id: 'comp-3',
            company_name: 'Gamma',
            region: 'Paris',
            contact_count: 2,
            company_research: { facts: ['y'] },
            enrichment: {
              status: 'stale',
              last_updated_at: '2026-01-01T10:00:00Z',
              provider_hint: 'firecrawl',
            },
          },
        ],
      },
      'paris',
      'all',
      'contacts'
    );

    expect(rows.map((row) => row.company_id)).toEqual(['comp-3', 'comp-2']);

    const staleRows = filterAndSortCampaignCompanies(
      {
        campaign: { id: 'camp-1', name: 'Q1 Push', segment_id: 'seg-1', segment_version: 2 },
        companies: [
          {
            company_id: 'comp-1',
            company_name: 'Alpha',
            contact_count: 4,
            company_research: { facts: ['x'] },
            enrichment: {
              status: 'fresh',
              last_updated_at: '2026-03-16T10:00:00Z',
              provider_hint: 'exa',
            },
          },
          {
            company_id: 'comp-3',
            company_name: 'Gamma',
            contact_count: 2,
            company_research: { facts: ['y'] },
            enrichment: {
              status: 'stale',
              last_updated_at: '2026-01-01T10:00:00Z',
              provider_hint: 'firecrawl',
            },
          },
        ],
      },
      '',
      'stale',
      'updated'
    );

    expect(staleRows.map((row) => row.company_id)).toEqual(['comp-3']);
  });
});
