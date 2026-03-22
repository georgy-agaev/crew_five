import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyPipelineStepRouter } from './LegacyPipelineStepRouter';
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

const copy = {
  locked: {
    title: 'Complete the previous step first',
    subtitle: 'This step becomes available once the dependency is ready.',
  },
  steps: {
    draft: { label: 'Draft' },
    segment: { label: 'Segment' },
    send: { label: 'Send' },
  },
  segment: {
    subtitle: 'From ICP',
    hypothesis: 'Hypothesis',
  },
  icp: {
    title: 'Ideal Customer Profile',
    subtitle: 'Select or create the ICP that defines your target market.',
    chooseExisting: 'Existing ICPs',
    createNew: 'Create new ICP',
    updated: 'Updated',
    chatWithAI: 'Chat with AI',
    chatDesc: 'Generate an ICP with the assistant.',
    quickEntry: 'Quick Entry',
    quickDesc: 'Create from a short description.',
    companies: 'companies',
  },
};

describe('LegacyPipelineStepRouter', () => {
  it('renders the ICP step branch', () => {
    const html = renderToString(
      <LegacyPipelineStepRouter
        aiLoading={false}
        colors={colors}
        completed={{}}
        copy={copy}
        currentStep="icp"
        icpProfiles={[{ id: 'icp_1', name: 'B2B SaaS', company_count: 42 }]}
        newIcpDescription=""
        newIcpName=""
        onCreateIcpQuick={vi.fn()}
        onIcpDescriptionChange={vi.fn()}
        onIcpNameChange={vi.fn()}
        onOpenAiChat={vi.fn()}
        onSelectIcp={vi.fn()}
      />
    );

    expect(html).toContain('Ideal Customer Profile');
    expect(html).toContain('Existing ICPs');
    expect(html).toContain('Create new ICP');
  });

  it('renders the locked fallback for unknown steps', () => {
    const html = renderToString(
      <LegacyPipelineStepRouter
        aiLoading={false}
        colors={colors}
        completed={{}}
        copy={copy}
        currentStep="unknown"
      />
    );

    expect(html).toContain('Complete the previous step first');
    expect(html).toContain('This step becomes available once the dependency is ready.');
  });
});
