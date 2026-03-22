import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { Settings } from '../../hooks/useSettingsStore';
import { LegacyPromptRegistryPage } from './LegacyPromptRegistryPage';
import type { TaskPromptsState } from './legacyWorkspacePromptHelpers';
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

const settings: Settings = {
  retryCapMs: 5000,
  assumeNow: false,
  telemetry: false,
  providers: {
    assistant: { provider: 'openai', model: 'gpt-4o' },
    icp: { provider: 'openai', model: 'gpt-4o-mini' },
    hypothesis: { provider: 'openai', model: 'gpt-4o-mini' },
    draft: { provider: 'openai', model: 'gpt-4o-mini' },
  },
  taskPrompts: {},
};

const copy = {
  title: 'Prompt Registry',
  subtitle: 'Manage prompts and rollout states',
  allPrompts: 'All prompts',
  active: 'Active',
  pilot: 'Pilot',
  retired: 'Retired',
  createNew: 'Create new',
  step: 'Step',
  promptId: 'Prompt ID',
  version: 'Version',
  status: 'Status',
  description: 'Description',
  promptText: 'Prompt text',
  noPrompts: 'No prompts yet',
  noPromptsDesc: 'Create your first prompt to start optimizing your AI workflows.',
  setActive: 'Set active',
  activeLabel: 'Active',
};

const taskLabels = {
  icpDiscovery: 'ICP Discovery',
  hypothesisGen: 'Hypothesis Generation',
  emailDraft: 'Email Draft',
  linkedinMsg: 'LinkedIn Message',
};

describe('LegacyPromptRegistryPage', () => {
  it('renders prompt registry header, filters, and create CTA', () => {
    const html = renderToString(
      <LegacyPromptRegistryPage
        colors={colors}
        copy={copy}
        entries={[]}
        filterStatus="all"
        llmModels={{ openai: ['gpt-4o-mini'], anthropic: ['claude-3-5-haiku-latest'] }}
        llmModelsError={{}}
        promptCreateForm={{
          id: '',
          version: 'v1',
          rollout_status: 'pilot',
          description: '',
          prompt_text: '',
        }}
        promptError={null}
        promptLoading={false}
        settings={settings}
        showPromptCreate={false}
        taskLabels={taskLabels}
        taskPrompts={{} satisfies TaskPromptsState}
        onCreateToggle={vi.fn()}
        onDismissCreate={vi.fn()}
        onFieldChange={vi.fn()}
        onFilterChange={vi.fn()}
        onModelChange={vi.fn()}
        onPromptChange={vi.fn()}
        onProviderChange={vi.fn()}
        onSave={vi.fn()}
        onSetActive={vi.fn()}
      />
    );

    expect(html).toContain('Prompt Registry');
    expect(html).toContain('Manage prompts and rollout states');
    expect(html).toContain('All prompts');
    expect(html).toContain('Active');
    expect(html).toContain('Pilot');
    expect(html).toContain('Retired');
    expect(html).toContain('Create new');
    expect(html).toContain('SOON');
  });

  it('renders prompt create form when expanded', () => {
    const html = renderToString(
      <LegacyPromptRegistryPage
        colors={colors}
        copy={copy}
        entries={[]}
        filterStatus="pilot"
        llmModels={{ openai: ['gpt-4o-mini'], anthropic: ['claude-3-5-haiku-latest'] }}
        llmModelsError={{}}
        promptCreateForm={{
          id: '',
          version: 'v1',
          rollout_status: 'pilot',
          description: '',
          prompt_text: '',
        }}
        promptError={null}
        promptLoading={false}
        settings={settings}
        showPromptCreate
        taskLabels={taskLabels}
        taskPrompts={{ emailDraft: 'draft_intro_v1' }}
        onCreateToggle={vi.fn()}
        onDismissCreate={vi.fn()}
        onFieldChange={vi.fn()}
        onFilterChange={vi.fn()}
        onModelChange={vi.fn()}
        onPromptChange={vi.fn()}
        onProviderChange={vi.fn()}
        onSave={vi.fn()}
        onSetActive={vi.fn()}
      />
    );

    expect(html).toContain('New prompt entry');
    expect(html).toContain('Prompt ID');
    expect(html).toContain('Version');
    expect(html).toContain('Status');
    expect(html).toContain('Description');
    expect(html).toContain('Prompt text');
    expect(html).toContain('Save prompt');
    expect(html).toContain('Cancel');
  });
});
