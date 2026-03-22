import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyDraftStep } from './LegacyDraftStep';
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

describe('LegacyDraftStep', () => {
  it('renders locked copy when no segment is selected', () => {
    const html = renderToString(
      <LegacyDraftStep
        campaignCreateBusy={false}
        campaignCreateError={null}
        campaigns={[]}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          draftLabel: 'Draft',
          segmentSubtitleLabel: 'ICP:',
          hypothesisLabel: 'Hypothesis:',
          segmentLabel: 'Segment',
        }}
        dataQualityMode="strict"
        draftDryRun
        draftLimit={50}
        draftLoading={false}
        draftSummary={null}
        hasSegment={false}
        interactionMode="express"
        newCampaignName=""
        selectedCampaignId=""
        selectionSummary={{ icp: null, hypothesis: null, segment: null }}
        onCampaignChange={vi.fn()}
        onCreateCampaign={vi.fn()}
        onDataQualityModeChange={vi.fn()}
        onDraftDryRunChange={vi.fn()}
        onDraftLimitChange={vi.fn()}
        onGenerateDrafts={vi.fn()}
        onInteractionModeChange={vi.fn()}
        onNewCampaignNameChange={vi.fn()}
      />
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Complete the previous step first.');
  });

  it('renders draft generation settings, campaign controls, and summary panel', () => {
    const html = renderToString(
      <LegacyDraftStep
        campaignCreateBusy={false}
        campaignCreateError="Campaign creation failed"
        campaigns={[{ id: 'camp-1', name: 'Outbound Alpha' }]}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          draftLabel: 'Draft',
          segmentSubtitleLabel: 'ICP:',
          hypothesisLabel: 'Hypothesis:',
          segmentLabel: 'Segment',
        }}
        dataQualityMode="strict"
        draftDryRun={false}
        draftLimit={75}
        draftLoading={false}
        draftSummary="Drafts ready: generated=12, failed=0, skippedNoEmail=1, dryRun=false, modes=strict/express"
        hasSegment
        interactionMode="express"
        newCampaignName="Q2 Pilot"
        selectedCampaignId="camp-1"
        selectionSummary={{
          icp: 'Enterprise SaaS',
          hypothesis: 'CTOs with outbound teams',
          segment: 'Priority Accounts',
        }}
        onCampaignChange={vi.fn()}
        onCreateCampaign={vi.fn()}
        onDataQualityModeChange={vi.fn()}
        onDraftDryRunChange={vi.fn()}
        onDraftLimitChange={vi.fn()}
        onGenerateDrafts={vi.fn()}
        onInteractionModeChange={vi.fn()}
        onNewCampaignNameChange={vi.fn()}
      />
    );

    expect(html).toContain('Draft');
    expect(html).toContain('Enterprise SaaS');
    expect(html).toContain('CTOs with outbound teams');
    expect(html).toContain('Priority Accounts');
    expect(html).toContain('Campaign &amp; generation settings');
    expect(html).toContain('Campaign');
    expect(html).toContain('New campaign name');
    expect(html).toContain('Create campaign');
    expect(html).toContain('Draft limit');
    expect(html).toContain('Data quality');
    expect(html).toContain('Interaction mode');
    expect(html).toContain('Draft execution');
    expect(html).toContain('Generate drafts');
    expect(html).toContain('Draft summary');
    expect(html).toContain('Campaign creation failed');
    expect(html).toContain('Drafts ready: generated=12');
  });
});
