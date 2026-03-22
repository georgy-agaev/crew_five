import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyEnrichmentStep } from './LegacyEnrichmentStep';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

const colors: LegacyWorkspaceColors = {
  bg: '#fff',
  text: '#111',
  textMuted: '#666',
  border: '#ddd',
  navSidebar: '#f7f7f7',
  sidebar: '#fafafa',
  card: '#fff',
  cardHover: '#f5f5f5',
  orange: '#f97316',
  orangeLight: '#fff7ed',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

describe('LegacyEnrichmentStep', () => {
  it('renders locked copy when no segment is selected', () => {
    const html = renderToString(
      <LegacyEnrichmentStep
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Enrichment',
          subtitle: 'Segment',
          from: 'From',
          optional: 'Optional but recommended',
          optionalDesc: 'Adds more data before draft generation.',
          companyData: 'Company data',
          companyDesc: 'Firmographics and business context.',
          leadDetails: 'Lead details',
          leadDesc: 'Role and contact-level enrichment.',
          webIntel: 'Web intelligence',
          webDesc: 'Signals from recent public web data.',
          enrich: 'Enrich segment',
          skip: 'Skip for now',
        }}
        enrichLoading={false}
        enrichResults={null}
        enrichStatus={null}
        enrichmentDefaults={[]}
        enrichmentPrimarySummary={{ company: null, lead: null }}
        hasSegment={false}
        isProviderReady={vi.fn(() => true)}
        providerOptions={[]}
        segmentSummary={null}
        selectedProviders={[]}
        onEnrich={vi.fn()}
        onProviderToggle={vi.fn()}
        onResetToDefaults={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Complete the previous step first.');
  });

  it('renders provider controls, cards, and result summary for selected segment', () => {
    const html = renderToString(
      <LegacyEnrichmentStep
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Enrichment',
          subtitle: 'Segment',
          from: 'From',
          optional: 'Optional but recommended',
          optionalDesc: 'Adds more data before draft generation.',
          companyData: 'Company data',
          companyDesc: 'Firmographics and business context.',
          leadDetails: 'Lead details',
          leadDesc: 'Role and contact-level enrichment.',
          webIntel: 'Web intelligence',
          webDesc: 'Signals from recent public web data.',
          enrich: 'Enrich segment',
          skip: 'Skip for now',
        }}
        enrichLoading={false}
        enrichResults={[{ provider: 'exa', status: 'completed', error: null }]}
        enrichStatus="completed"
        enrichmentDefaults={['exa', 'mock']}
        enrichmentPrimarySummary={{ company: 'exa', lead: 'mock' }}
        hasSegment
        isProviderReady={(providerId) => providerId !== 'parallel'}
        providerOptions={[
          { id: 'exa', label: 'EXA' },
          { id: 'parallel', label: 'Parallel' },
          { id: 'mock', label: 'Mock' },
        ]}
        segmentSummary={{ name: 'Priority Accounts', source: 'database' }}
        selectedProviders={['exa']}
        onEnrich={vi.fn()}
        onProviderToggle={vi.fn()}
        onResetToDefaults={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(html).toContain('Enrichment');
    expect(html).toContain('Priority Accounts');
    expect(html).toContain('database');
    expect(html).toContain('Optional but recommended');
    expect(html).toContain('Company data');
    expect(html).toContain('Lead details');
    expect(html).toContain('Web intelligence');
    expect(html).toContain('Providers');
    expect(html).toContain('EXA');
    expect(html).toContain('Parallel');
    expect(html).toContain('Reset to defaults');
    expect(html).toContain('Primary providers for workflow:');
    expect(html).toContain('company');
    expect(html).toContain('lead');
    expect(html).toContain('mock');
    expect(html).toContain('Enrich segment');
    expect(html).toContain('Skip for now');
    expect(html).toContain('EXA');
    expect(html).toContain('completed');
  });
});
