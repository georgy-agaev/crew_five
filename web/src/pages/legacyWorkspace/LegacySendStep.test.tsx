import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacySendStep } from './LegacySendStep';
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

describe('LegacySendStep', () => {
  it('renders locked copy when no draft is ready', () => {
    const html = renderToString(
      <LegacySendStep
        campaigns={[]}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          notSelected: 'Not selected',
          sendLabel: 'Send',
        }}
        hasDraft={false}
        selectedCampaignId=""
        selectedSmartleadCampaignId=""
        sendBatchSize={25}
        sendDryRun
        sendLoading={false}
        sendSummary={null}
        smartleadCampaigns={[]}
        smartleadReady={false}
        onBatchSizeChange={vi.fn()}
        onDryRunChange={vi.fn()}
        onPrepare={vi.fn()}
        onSmartleadCampaignChange={vi.fn()}
      />
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Complete the previous step first.');
  });

  it('renders smartlead prepare controls and safety guardrail when draft exists', () => {
    const html = renderToString(
      <LegacySendStep
        campaigns={[{ id: 'camp-1', name: 'Outbound Alpha' }]}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          notSelected: 'Not selected',
          sendLabel: 'Send',
        }}
        hasDraft
        selectedCampaignId="camp-1"
        selectedSmartleadCampaignId="sl-1"
        sendBatchSize={50}
        sendDryRun
        sendLoading={false}
        sendSummary="Smartlead prepare: fetched=10, sent=8, skipped=2"
        smartleadCampaigns={[{ id: 'sl-1', name: 'SL Campaign' }]}
        smartleadReady
        onBatchSizeChange={vi.fn()}
        onDryRunChange={vi.fn()}
        onPrepare={vi.fn()}
        onSmartleadCampaignChange={vi.fn()}
      />
    );

    expect(html).toContain('Send');
    expect(html).toContain('Delivery provider:');
    expect(html).toContain('Smartlead (ready)');
    expect(html).toContain('Outbound Alpha');
    expect(html).toContain('Smartlead prepare');
    expect(html).toContain('Smartlead campaign');
    expect(html).toContain('Dry-run (no Smartlead changes)');
    expect(html).toContain('Batch size');
    expect(html).toContain('Prepare Smartlead');
    expect(html).toContain('Safety guardrail');
    expect(html).toContain('Smartlead prepare: fetched=10, sent=8, skipped=2');
  });
});
