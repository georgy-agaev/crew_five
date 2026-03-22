import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { formatPromptLabel, PromptRegistryPage } from './PromptRegistryPage';
import * as apiClient from '../apiClient';

describe('PromptRegistryPage helpers', () => {
  it('formats prompt label with version/status only', () => {
    const label = formatPromptLabel({
      id: 'draft_intro_v4',
      version: 'v4',
      rollout_status: 'pilot',
    } as any);
    expect(label).toBe('draft_intro_v4 v4 · pilot');
  });

  it('renders system prompt text copy for prompt_text field', async () => {
    vi.spyOn(apiClient, 'fetchPromptRegistry').mockResolvedValue([] as any);
    const createSpy = vi
      .spyOn(apiClient, 'createPromptRegistryEntry')
      .mockResolvedValue(undefined as any);
    vi.spyOn(apiClient, 'setActivePrompt').mockResolvedValue(undefined as any);

    render(React.createElement(PromptRegistryPage));

    const textarea = await screen.findByPlaceholderText(/System prompt text/i);
    expect(textarea).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
