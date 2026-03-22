import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyPipelineShell } from './LegacyPipelineShell';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

const colors: LegacyWorkspaceColors = {
  bg: '#f8fafc',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  navSidebar: '#ffffff',
  sidebar: '#ffffff',
  card: '#ffffff',
  cardHover: '#f3f4f6',
  orange: '#f97316',
  orangeLight: '#ffedd5',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

describe('LegacyPipelineShell', () => {
  it('renders pipeline steps, current config summary, and injected step content', () => {
    const html = renderToString(
      <LegacyPipelineShell
        colors={colors}
        currentStep="hypothesis"
        currentConfigLabel="Current Configuration"
        notSelectedLabel="Not selected"
        pipeline={[
          { id: 'icp', label: 'ICP', number: 1, locked: false, description: 'Choose ICP' },
          { id: 'hypothesis', label: 'Hypothesis', number: 2, locked: false, description: 'Choose hypothesis' },
          { id: 'segment', label: 'Segment', number: 3, locked: false, description: 'Choose segment' },
        ]}
        completed={{
          icp: { id: 'icp_1', name: 'EU B2B SaaS', value_proposition: 'Save time' },
          hypothesis: {
            id: 'hyp_1',
            hypothesis_label: 'CTO latency pain',
            search_config: { regions: ['EU'] },
          },
          segment: { id: 'seg_1', name: 'Warm CTO list' },
        }}
        stepLabels={{
          icp: 'ICP',
          hypothesis: 'Hypothesis',
          segment: 'Segment',
        }}
        icpSummary={{
          valueProp: 'Save time',
          industries: ['SaaS'],
          companySizes: ['51-200'],
          pains: ['Slow prospecting'],
          triggers: ['Hiring'],
        }}
        hypothesisSummary={{
          regions: ['EU'],
          offers: [{ personaRole: 'CTO', offer: 'Faster outbound' }],
          critiques: [{ roast: 'Needs proof' }],
        }}
        onStepSelect={vi.fn()}
      >
        <div>Injected step content</div>
      </LegacyPipelineShell>
    );

    expect(html).toContain('>ICP<');
    expect(html).toContain('>Hypothesis<');
    expect(html).toContain('Current Configuration');
    expect(html).toContain('EU B2B SaaS');
    expect(html).toContain('Save time');
    expect(html).toContain('CTO latency pain');
    expect(html).toContain('Warm CTO list');
    expect(html).toContain('Injected step content');
  });
});
