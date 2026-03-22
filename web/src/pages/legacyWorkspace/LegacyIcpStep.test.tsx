import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LegacyIcpStep } from './LegacyIcpStep';
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

describe('LegacyIcpStep', () => {
  it('renders existing icp cards, ai card, and quick create form', () => {
    const html = renderToString(
      <LegacyIcpStep
        aiLoading={false}
        colors={colors}
        companiesLabel="companies"
        copy={{
          title: 'Choose or Create ICP',
          subtitle: 'Start by defining your Ideal Customer Profile.',
          chooseExisting: 'Choose Existing',
          createNew: 'Create New',
          updated: 'Updated',
          aiTitle: 'Chat with AI',
          aiDesc: 'Describe your ideal customer and let AI help',
          quickEntry: 'Quick Entry',
          quickDesc: 'Enter details directly in a form',
        }}
        icpProfiles={[
          { id: 'icp-1', name: 'Enterprise SaaS', company_count: 42, updated_at: '2026-03-15' },
          { id: 'icp-2', company_count: 11, created_at: '2026-03-12' },
        ]}
        newIcpDescription="B2B software companies"
        newIcpName="Revenue teams"
        selectedIcpId="icp-1"
        onCreateQuick={vi.fn()}
        onDescriptionChange={vi.fn()}
        onNameChange={vi.fn()}
        onOpenAiChat={vi.fn()}
        onSelectIcp={vi.fn()}
      />
    );

    expect(html).toContain('Choose or Create ICP');
    expect(html).toContain('Choose Existing');
    expect(html).toContain('Enterprise SaaS');
    expect(html).toContain('42');
    expect(html).toContain('companies');
    expect(html).toContain('Updated');
    expect(html).toContain('Create New');
    expect(html).toContain('Chat with AI');
    expect(html).toContain('Describe your ideal customer and let AI help');
    expect(html).toContain('Quick Entry');
    expect(html).toContain('Enter details directly in a form');
    expect(html).toContain('ICP name');
    expect(html).toContain('Optional description');
    expect(html).toContain('Save ICP');
  });
});
