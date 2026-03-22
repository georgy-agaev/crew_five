import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyHypothesisStep } from './LegacyHypothesisStep';
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

describe('LegacyHypothesisStep', () => {
  it('renders locked copy when no ICP is selected', () => {
    const html = renderToString(
      <LegacyHypothesisStep
        aiLoading={false}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Choose or Create Hypothesis',
          subtitle: 'Based on your ICP:',
          suggested: 'Suggested Hypotheses',
          confidence: 'Confidence',
          aiTitle: 'Chat with AI',
          chatDesc: 'Brainstorm targeting hypotheses together',
          writeHyp: 'Write Hypothesis',
          writeDesc: 'Type your targeting hypothesis directly',
        }}
        hasIcp={false}
        hypotheses={[]}
        icpName={null}
        newHypothesisLabel=""
        selectedHypothesisId={null}
        onCreateQuick={vi.fn()}
        onOpenAiChat={vi.fn()}
        onQuickLabelChange={vi.fn()}
        onSelectHypothesis={vi.fn()}
      />
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Complete the previous step first.');
  });

  it('renders suggested hypotheses, confidence labels, ai card, and quick create form', () => {
    const html = renderToString(
      <LegacyHypothesisStep
        aiLoading={false}
        colors={colors}
        copy={{
          lockedTitle: 'Locked',
          lockedSubtitle: 'Complete the previous step first.',
          title: 'Choose or Create Hypothesis',
          subtitle: 'Based on your ICP:',
          suggested: 'Suggested Hypotheses',
          confidence: 'Confidence',
          aiTitle: 'Chat with AI',
          chatDesc: 'Brainstorm targeting hypotheses together',
          writeHyp: 'Write Hypothesis',
          writeDesc: 'Type your targeting hypothesis directly',
        }}
        hasIcp
        hypotheses={[
          { id: 'hyp-1', hypothesis_label: 'CTOs at enterprise SaaS', confidence: 'High' },
          { id: 'hyp-2', text: 'VP Sales at fast-growth B2B', status: 'active' },
        ]}
        icpName="Enterprise SaaS"
        newHypothesisLabel="New wedge"
        selectedHypothesisId="hyp-1"
        onCreateQuick={vi.fn()}
        onOpenAiChat={vi.fn()}
        onQuickLabelChange={vi.fn()}
        onSelectHypothesis={vi.fn()}
      />
    );

    expect(html).toContain('Choose or Create Hypothesis');
    expect(html).toContain('Enterprise SaaS');
    expect(html).toContain('Suggested Hypotheses');
    expect(html).toContain('CTOs at enterprise SaaS');
    expect(html).toContain('VP Sales at fast-growth B2B');
    expect(html).toContain('Confidence');
    expect(html).toContain('High');
    expect(html).toContain('Chat with AI');
    expect(html).toContain('Brainstorm targeting hypotheses together');
    expect(html).toContain('Write Hypothesis');
    expect(html).toContain('Type your targeting hypothesis directly');
    expect(html).toContain('Hypothesis label');
    expect(html).toContain('Save hypothesis');
  });
});
