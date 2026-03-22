import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyAiChatModal } from './LegacyAiChatModal';
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

describe('LegacyAiChatModal', () => {
  it('renders title, greeting, transcript, error, and footer controls', () => {
    const html = renderToString(
      <LegacyAiChatModal
        aiError="Failed to generate"
        aiLoading={false}
        aiMessage="Find enterprise CTOs"
        aiTranscript={[
          { role: 'assistant', text: 'Tell me more about your ICP.' },
          { role: 'user', text: 'Enterprise CTOs in SaaS' },
        ]}
        colors={colors}
        copy={{
          title: 'AI Assistant',
          greeting: 'You are working on',
          greeting2: 'Describe what you want to create.',
          placeholder: 'Type your prompt',
          send: 'Send',
        }}
        currentStep="icp"
        onClose={vi.fn()}
        onMessageChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toContain('AI Assistant');
    expect(html).toContain('You are working on');
    expect(html).toContain('icp');
    expect(html).toContain('Tell me more about your ICP.');
    expect(html).toContain('Enterprise CTOs in SaaS');
    expect(html).toContain('Failed to generate');
    expect(html).toContain('Type your prompt');
    expect(html).toContain('Send');
  });
});
