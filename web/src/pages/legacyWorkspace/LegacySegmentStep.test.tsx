import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacySegmentStep } from './LegacySegmentStep';
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

describe('LegacySegmentStep', () => {
  it('renders locked copy when no hypothesis is selected', () => {
    const html = renderToString(
      <LegacySegmentStep
        colors={colors}
        companiesLabel="companies"
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Select or Generate Segments',
          subtitle: 'ICP:',
          hypothesis: 'Hypothesis:',
          matching: 'Matching Segments',
          source: 'Source',
          generateNew: 'Generate New',
          searchDB: 'Search Database',
          searchDesc: 'Query your existing company database',
          exaSearch: 'EXA Web Search',
          exaDesc: 'Find new companies from the web',
        }}
        discoveryStatus={null}
        hasHypothesis={false}
        hasPersistedDiscoveryRun={false}
        onOpenDiscovery={vi.fn()}
        onOpenExaSearch={vi.fn()}
        onOpenSegmentBuilder={vi.fn()}
        onSelectSegment={vi.fn()}
        segments={[]}
        selectionSummary={{ icp: null, hypothesis: null, selectedSegmentId: null }}
      />
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Complete the previous step first.');
  });

  it('renders matching segments, generation cards, and discovery review CTA', () => {
    const html = renderToString(
      <LegacySegmentStep
        colors={colors}
        companiesLabel="companies"
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Select or Generate Segments',
          subtitle: 'ICP:',
          hypothesis: 'Hypothesis:',
          matching: 'Matching Segments',
          source: 'Source',
          generateNew: 'Generate New',
          searchDB: 'Search Database',
          searchDesc: 'Query your existing company database',
          exaSearch: 'EXA Web Search',
          exaDesc: 'Find new companies from the web',
        }}
        discoveryStatus="Discovery run queued"
        hasHypothesis
        hasPersistedDiscoveryRun
        onOpenDiscovery={vi.fn()}
        onOpenExaSearch={vi.fn()}
        onOpenSegmentBuilder={vi.fn()}
        onSelectSegment={vi.fn()}
        segments={[
          { id: 'seg-1', name: 'Priority Accounts', company_count: 42, source: 'Database' },
          { id: 'seg-2', name: 'ICP Match', company_count: 17, source: 'ICP' },
        ]}
        selectionSummary={{
          icp: 'Enterprise SaaS',
          hypothesis: 'CTOs with outbound teams',
          selectedSegmentId: 'seg-1',
        }}
      />
    );

    expect(html).toContain('Select or Generate Segments');
    expect(html).toContain('Enterprise SaaS');
    expect(html).toContain('CTOs with outbound teams');
    expect(html).toContain('Matching Segments');
    expect(html).toContain('Priority Accounts');
    expect(html).toContain('42');
    expect(html).toContain('companies');
    expect(html).toContain('Source');
    expect(html).toContain('Generate New');
    expect(html).toContain('Search Database');
    expect(html).toContain('EXA Web Search');
    expect(html).toContain('Discovery run queued');
    expect(html).toContain('Review candidates in ICP Discovery');
  });
});
