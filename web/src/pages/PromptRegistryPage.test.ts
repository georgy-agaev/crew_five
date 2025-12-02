import { describe, expect, it } from 'vitest';

import { formatPromptLabel } from './PromptRegistryPage';

describe('PromptRegistryPage helpers', () => {
  it('formats prompt label with step/version/status', () => {
    const label = formatPromptLabel({
      id: 'draft_intro_v4',
      step: 'draft',
      version: 'v4',
      rollout_status: 'pilot',
    } as any);
    expect(label).toBe('draft_intro_v4 (draft) v4 · pilot');
  });
});
