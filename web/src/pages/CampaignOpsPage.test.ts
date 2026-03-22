import { describe, expect, it } from 'vitest';

import {
  formatEnrichmentStateLabel,
  getCampaignCompanyResearchStatus,
  summarizeCampaignCompanies,
} from './CampaignOpsPage';

describe('CampaignOpsPage helpers', () => {
  it('classifies company research status', () => {
    expect(
      getCampaignCompanyResearchStatus({
        company_id: 'comp-1',
        company_name: 'Example Co',
        contact_count: 2,
        company_research: { facts: ['x'] },
        enrichment: {
          status: 'fresh',
          last_updated_at: '2026-03-15T10:00:00Z',
          provider_hint: 'exa',
        },
      })
    ).toBe('enriched');

    expect(
      getCampaignCompanyResearchStatus({
        company_id: 'comp-2',
        company_name: 'No Research Co',
        contact_count: 1,
        company_research: null,
        enrichment: {
          status: 'missing',
          last_updated_at: null,
          provider_hint: null,
        },
      })
    ).toBe('missing');
  });

  it('formats enrichment state labels', () => {
    expect(formatEnrichmentStateLabel('fresh')).toBe('fresh');
    expect(formatEnrichmentStateLabel('stale')).toBe('stale');
    expect(formatEnrichmentStateLabel('missing')).toBe('missing');
  });

  it('summarizes campaign company counts', () => {
    const summary = summarizeCampaignCompanies({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      companies: [
        {
          company_id: 'comp-1',
          company_name: 'Example Co',
          contact_count: 2,
          company_research: { facts: ['x'] },
          enrichment: {
            status: 'fresh',
            last_updated_at: '2026-03-15T10:00:00Z',
            provider_hint: 'exa',
          },
        },
        {
          company_id: 'comp-2',
          company_name: 'Another Co',
          contact_count: 1,
          company_research: null,
          enrichment: {
            status: 'missing',
            last_updated_at: null,
            provider_hint: null,
          },
        },
      ],
    });

    expect(summary).toEqual({
      companyCount: 2,
      contactCount: 3,
      enrichedCount: 1,
      missingResearchCount: 1,
      freshCount: 1,
      staleCount: 0,
    });
  });
});
